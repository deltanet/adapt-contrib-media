define([
    'core/js/adapt',
    'core/js/views/componentView',
    'libraries/mediaelement-and-player',
    'libraries/mediaelement-and-player-accessible-captions',
    'libraries/mediaelement-fullscreen-hook'
], function(Adapt, ComponentView) {

    var froogaloopAdded = false;

    // The following function is used to to prevent a memory leak in Internet Explorer
    // See: http://javascript.crockford.com/memory/leak.html
    function purge(d) {
        var a = d.attributes, i, l, n;
        if (a) {
            for (i = a.length - 1; i >= 0; i -= 1) {
                n = a[i].name;
                if (typeof d[n] === 'function') {
                    d[n] = null;
                }
            }
        }
        a = d.childNodes;
        if (a) {
            l = a.length;
            for (i = 0; i < l; i += 1) {
                purge(d.childNodes[i]);
            }
        }
    }

    var MediaAutoplay = ComponentView.extend({

        events: {
            "click .media-inline-transcript-button": "initNotify",
            "click .media-external-transcript-button": "onExternalTranscriptClicked",
            "click .media-subtitles-button": "onSubtitlesClicked",
            "click .media-subtitles-option": "onSubtitlesOptionClicked",
            "click .mejs-captions-selector": "onMediaElementCaptionsChange"
        },

        preRender: function() {
          this.listenTo(this.model, 'change:_isComplete', this.checkCompletion);

            this.listenTo(Adapt, {
                'popup:opened': this.notifyOpened,
                'popup:closed': this.notifyClosed,
                'device:resize': this.onScreenSizeChanged,
                'device:changed': this.onDeviceChanged,
                'accessibility:toggle': this.onAccessibilityToggle,
                'media:stop': this.onMediaStop
            });

            _.bindAll(this, 'onMediaElementPlay', 'onMediaElementPause', 'onMediaElementEnded', 'onMediaElementTimeUpdate', 'onMediaElementSeeking');

            // set initial player state attributes
            this.model.set({
                '_isMediaEnded': false,
                '_isMediaPlaying': false
            });

            if (this.model.get('_media').source) {
                // Remove the protocol for streaming service.
                // This prevents conflicts with HTTP/HTTPS
                var media = this.model.get('_media');

                media.source = media.source.replace(/^https?\:/, "");

                this.model.set('_media', media);
            }

            this.checkIfResetOnRevisit();
        },

        postRender: function() {
            this.setupPlayer();
            // Set up instructions
            if(this.model.has('_videoInstruction')) {
              if(this.model.get('_videoInstruction')._isEnabled) {
                this.setupInstructions();
              }
            }
            // Check if notify is visible
            if ($('body').children('.notify').css('visibility') == 'visible') {
                this.notifyOpened();
            }
        },

        notifyOpened: function() {
            this.notifyIsOpen = true;
            this.playMediaElement(false);
        },

        notifyClosed: function() {
            this.notifyIsOpen = false;
            if (this.videoIsInView == true && this.mediaCanAutoplay && this.firstRun) {
                this.playMediaElement(true);
            }
        },

        setupInstructions: function() {
          // Position instructions
          this.instructionPosition = this.model.get('_videoInstruction')._position;
          this.positionInstruction();
          // Determine start and end instructions based on the completion status
          if(this.model.get("_isComplete")) {
            this.instructionStart = this.model.get('_videoInstruction')._revisit.start;
            this.instructionEnd = this.model.get('_videoInstruction')._revisit.end;
          } else {
            this.instructionStart = this.model.get('_videoInstruction')._first.start;
            this.instructionEnd = this.model.get('_videoInstruction')._first.end;
          }
          // If hidden on revisit
          if((this.model.get("_isComplete") && this.model.get('_videoInstruction')._hideOnRevisit) || this.mediaCanAutoplay) {
            this.hideInstruction();
          } else {
            this.changeInstructionStart();
          }
        },

        setupPlayer: function() {
            if (!this.model.get('_playerOptions')) this.model.set('_playerOptions', {});

            var modelOptions = this.model.get('_playerOptions');

            if (modelOptions.pluginPath === undefined) modelOptions.pluginPath = 'assets/';
            if(modelOptions.features === undefined) {
                modelOptions.features = ['playpause','progress','current','duration', 'volume'];
                if (this.model.get('_useClosedCaptions')) {
                    modelOptions.features.unshift('tracks');
                }
                if (this.model.get("_allowFullScreen") && !$("html").is(".ie9")) {
                    modelOptions.features.push('fullscreen');
                }
                if (this.model.get('_showVolumeControl')) {
                    modelOptions.features.push('volume');
                }
            }

            modelOptions.success = _.bind(this.onPlayerReady, this);

            if (this.model.get('_useClosedCaptions')) {
                modelOptions.startLanguage = this.model.get('_startLanguage') === undefined ? 'en' : this.model.get('_startLanguage');
                this.setupSubtitles();
            }

            var hasAccessibility = Adapt.config.has('_accessibility') && Adapt.config.get('_accessibility')._isActive
                ? true
                : false;

            if (hasAccessibility) {
                modelOptions.alwaysShowControls = true;
                modelOptions.hideVideoControlsOnLoad = false;
            }

            if (modelOptions.alwaysShowControls === undefined) {
                modelOptions.alwaysShowControls = false;
            }
            if (modelOptions.hideVideoControlsOnLoad === undefined) {
                modelOptions.hideVideoControlsOnLoad = true;
            }

            this.addMediaTypeClass();

            this.addThirdPartyFixes(modelOptions, _.bind(function createPlayer() {
                // create the player
                this.$('audio, video').mediaelementplayer(modelOptions);

                // We're streaming - set ready now, as success won't be called above
                try {
                    if (this.model.get('_media').source) {
                        this.$('.media-widget').addClass('external-source');
                    }
                } catch (e) {
                    console.log("ERROR! No _media property found in components.json for component " + this.model.get('_id'));
                } finally {
                    this.setReadyStatus();
                }
            }, this));

            this.firstRun = true;
            this.notifyIsOpen = false;
            this.mediaAutoplayOnce = this.model.get('_autoPlayOnce');
            this.mediaCanAutoplay = this.model.get('_autoPlay');

            this.setVideoVolume();
        },

        addMediaTypeClass: function() {
            var media = this.model.get("_media");
            if (media && media.type) {
                var typeClass = media.type.replace(/\//, "-");
                this.$(".media-widget").addClass(typeClass);
            }
        },

        addThirdPartyFixes: function(modelOptions, callback) {
            var media = this.model.get("_media");
            if (!media) return callback();

            switch (media.type) {
                case "video/vimeo":
                    modelOptions.alwaysShowControls = false;
                    modelOptions.hideVideoControlsOnLoad = true;
                    modelOptions.features = [];
                    if (froogaloopAdded) return callback();
                    Modernizr.load({
                        load: "assets/froogaloop.js",
                        complete: function() {
                            froogaloopAdded = true;
                            callback();
                        }
                    });
                    break;
                default:
                    callback();
            }
        },

        setupEventListeners: function() {
            this.completionEvent = (!this.model.get('_setCompletionOn')) ? 'play' : this.model.get('_setCompletionOn');

            if (this.completionEvent === 'inview') {
                this.$('.component-widget').on('inview', _.bind(this.inview, this));
            }

            // wrapper to check if preventForwardScrubbing is turned on.
            if ((this.model.get('_preventForwardScrubbing')) && (!this.model.get('_isComplete'))) {
                $(this.mediaElement).on({
                    'seeking': this.onMediaElementSeeking,
                    'timeupdate': this.onMediaElementTimeUpdate
                });
            }

            // handle other completion events in the event Listeners
            $(this.mediaElement).on({
            	'play': this.onMediaElementPlay,
            	'pause': this.onMediaElementPause,
            	'ended': this.onMediaElementEnded
            });

            // Add listener for when the media is playing so the audio can be stopped
            if (this.model.get('_audio') && this.model.get('_audio')._isEnabled) {
                this.mediaElement.addEventListener('playing', _.bind(this.onPlayMedia, this));
            }

            this.listenTo(Adapt, "pageView:ready", this.pageReady);
            this.listenTo(Adapt, "audio:updateAudioStatus", this.setVideoVolume);
        },

        pageReady: function () {
          this.$('.component-widget').on("onscreen", _.bind(this.onscreen, this));
        },

        onMediaElementPlay: function(event) {

            Adapt.trigger("media:stop", this);

            this.model.set({
                '_isMediaPlaying': true,
                '_isMediaEnded': false
            });

            if (this.completionEvent === 'play') {
                this.setCompletionStatus();
            }

            if(this.model.has('_videoInstruction')) {
              if(this.model.get('_videoInstruction')._isEnabled) {
                this.hideInstruction();
              }
            }
        },

        onMediaElementPause: function(event) {
            this.model.set('_isMediaPlaying', false);
        },

        onMediaElementEnded: function(event) {
            this.model.set('_isMediaEnded', true);

            if (this.completionEvent === 'ended') {
                this.setCompletionStatus();
            }

            if(this.firstRun) {
              if(this.model.has('_videoInstruction')) {
                if(this.model.get('_videoInstruction')._isEnabled) {
                  this.changeInstructionEnd();
                }
              }
            }
            this.firstRun = false;
        },

        onMediaElementSeeking: function(event) {
            var maxViewed = this.model.get("_maxViewed");
            if(!maxViewed) {
                maxViewed = 0;
            }
            if (event.target.currentTime > maxViewed) {
                event.target.currentTime = maxViewed;
            }
        },

        onMediaElementTimeUpdate: function(event) {
            var maxViewed = this.model.get("_maxViewed");
            if (!maxViewed) {
                maxViewed = 0;
            }
            if (event.target.currentTime > maxViewed) {
                this.model.set("_maxViewed", event.target.currentTime);
            }
        },

        // Overrides the default play/pause functionality to stop accidental playing on touch devices
        setupPlayPauseToggle: function() {
            // bit sneaky, but we don't have a this.mediaElement.player ref on iOS devices
            var player = this.mediaElement.player;

            if (!player) {
                console.log("MediaAutoplay.setupPlayPauseToggle: OOPS! there's no player reference.");
                return;
            }

            // stop the player dealing with this, we'll do it ourselves
            player.options.clickToPlayPause = false;

            this.onOverlayClick = _.bind(this.onOverlayClick, this);
            this.onMediaElementClick = _.bind(this.onMediaElementClick, this);

            // play on 'big button' click
            this.$('.mejs-overlay-button').on("click", this.onOverlayClick);

            // pause on player click
            this.$('.mejs-mediaelement').on("click", this.onMediaElementClick);
        },

        onMediaStop: function(view) {

            // Make sure this view isn't triggering media:stop
            if (view && view.cid === this.cid) return;

            var player = this.mediaElement.player;
            if (!player) return;

            player.pause();
        },

        onOverlayClick: function() {
            var player = this.mediaElement.player;
            if (!player) return;

            player.play();
        },

        onMediaElementClick: function(event) {
            var player = this.mediaElement.player;
            if (!player) return;

            var isPaused = player.media.paused;
            if(!isPaused) player.pause();
        },

        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);
            }
        },

        onscreen: function(event, measurements) {

            var isOnscreenY = measurements.percentFromTop < 70 && measurements.percentFromTop > 0;
            var isOnscreenX = measurements.percentInviewHorizontal == 100;

            if (isOnscreenY && isOnscreenX) {
                if (this.model.get('_autoPlay') && this.notifyIsOpen == false && this.mediaCanAutoplay == true) {
                    this.playMediaElement(true);
                }
                if (this.model.get('_setCompletionOn') == 'inview') {
                    this.setCompletionStatus();
                }
                this.$('.component-widget').off('onscreen');
                this.videoIsInView = true;
            } else {
                this.playMediaElement(false);
                this.videoIsInView = false;
            }
        },

        playMediaElement: function(state) {
            if (this.model.get('_isVisible') && state) {
                this.mediaElement.play();
                // Set to false to stop autoplay when inview again
                if(this.mediaAutoplayOnce) {
                    this.mediaCanAutoplay = false;
                }
            } else if (state === false) {
                this.mediaElement.pause();
            }
        },

        remove: function() {
            this.$('.mejs-overlay-button').off("click", this.onOverlayClick);
            this.$('.mejs-mediaelement').off("click", this.onMediaElementClick);

            this.$('.component-widget').off('onscreen');

            var modelOptions = this.model.get('_playerOptions');
            delete modelOptions.success;

            var media = this.model.get("_media");
            if (media) {
                switch (media.type) {
                case "video/vimeo":
                    this.$("iframe")[0].isRemoved = true;
                }
            }

            if ($("html").is(".ie8")) {
                var obj = this.$("object")[0];
                if (obj) {
                    obj.style.display = "none";
                }
            }
            if (this.mediaElement && this.mediaElement.player) {
                var player_id = this.mediaElement.player.id;

                purge(this.$el[0]);
                this.mediaElement.player.remove();

                if (mejs.players[player_id]) {
                    delete mejs.players[player_id];
                }
            }
            if (this.mediaElement) {
                this.mediaElement.removeEventListener('playing', this.onPlayMedia);
                $(this.mediaElement).off({
                    'play': this.onMediaElementPlay,
                    'pause': this.onMediaElementPause,
                    'ended': this.onMediaElementEnded,
                    'seeking': this.onMediaElementSeeking,
                    'timeupdate': this.onMediaElementTimeUpdate
                });

                this.mediaElement.src = "";
                $(this.mediaElement.pluginElement).remove();
                delete this.mediaElement;
            }

            ComponentView.prototype.remove.call(this);
        },

        onPlayMedia: function() {
            if (!Adapt.audio.audioClip[this.model.get('_audio')._channel].paused) {
                Adapt.trigger('audio:pauseAudio', this.model.get('_audio')._channel);
            }
        },

        onDeviceChanged: function() {
            if (this.model.get('_media').source) {
                this.$('.mejs-container').width(this.$('.component-widget').width());
            }
            this.positionInstruction();
        },

        onPlayerReady: function (mediaElement, domObject) {
            this.mediaElement = mediaElement;

            if (!this.mediaElement.player) {
                this.mediaElement.player =  mejs.players[this.$('.mejs-container').attr('id')];
            }

            var hasTouch = mejs.MediaFeatures.hasTouch;
            if (hasTouch) {
                this.setupPlayPauseToggle();
            }

            this.addThirdPartyAfterFixes();

            if(this.model.has('_startVolume')) {
                // Setting the start volume only works with the Flash-based player if you do it here rather than in setupPlayer
                this.mediaElement.player.setVolume(parseInt(this.model.get('_startVolume'))/100);
            }

            this.setReadyStatus();
            this.setupEventListeners();
        },

        positionInstruction: function () {
          this.$('.media-instruction-container').css({
            top: this.instructionPosition,
            width: this.$('.component-widget').width()
          });
        },

        checkCompletion: function () {
          // Add check for element for backwards compatability
          if(this.model.has('_videoInstruction')) {
            if(this.model.get('_videoInstruction')._isEnabled && this.model.get("_isComplete")) {
              this.changeInstructionEnd();
            }
          }
        },

        changeInstructionStart: function () {
          // Check for empty elements
          if(this.instructionStart == "") {
            this.hideInstruction();
          } else {
            this.$('.video-instruction').find('.component-instruction-inner').html(this.instructionStart);
            this.showInstruction();
          }
        },

        changeInstructionEnd: function () {
          // Check for empty elements
          if(this.instructionEnd == "") {
            this.hideInstruction();
          } else {
            this.$('.video-instruction').find('.component-instruction-inner').html(this.instructionEnd);
            this.showInstruction();
          }
        },

        hideInstruction: function () {
          this.$('.video-instruction').hide();
        },

        showInstruction: function () {
          this.$('.media-instruction-container').css({ top: (this.instructionPosition - 20)+'%'});
          this.$('.video-instruction').show();
          if(Adapt.config.get('_disableAnimation')) {
            this.$('.media-instruction-container').css({ top: this.instructionPosition+'%'});
          } else {
            this.$('.media-instruction-container').animate({ top: this.instructionPosition+'%'}, 500);
          }
        },

        addThirdPartyAfterFixes: function() {
            var media = this.model.get("_media");
            switch (media.type) {
            case "video/vimeo":
                this.$(".mejs-container").attr("tabindex", 0);
            }
        },

        onScreenSizeChanged: function() {
            this.$('audio, video').width(this.$('.component-widget').width());
            this.positionInstruction();
        },

        onAccessibilityToggle: function() {
           this.showControls();
        },

        onToggleInlineTranscript: function(event) {
            if (event) event.preventDefault();
            var $transcriptBodyContainer = this.$(".media-inline-transcript-body-container");
            var $button = this.$(".media-inline-transcript-button");

            if ($transcriptBodyContainer.hasClass("inline-transcript-open")) {
                $transcriptBodyContainer.slideUp(function() {
                    $(window).resize();
                });
                $transcriptBodyContainer.removeClass("inline-transcript-open");
                $button.html(this.model.get("_transcript").inlineTranscriptButton);
            } else {
                $transcriptBodyContainer.slideDown(function() {
                    $(window).resize();
                }).a11y_focus();
                $transcriptBodyContainer.addClass("inline-transcript-open");
                $button.html(this.model.get("_transcript").inlineTranscriptCloseButton);
                if (this.model.get('_transcript')._setCompletionOnView !== false) {
                    this.setCompletionStatus();
                }
            }
            _.delay(_.bind(function() {
                Adapt.trigger('device:resize');
            }, this), 300);
        },

        onExternalTranscriptClicked: function(event) {
            if (this.model.get('_transcript')._setCompletionOnView !== false) {
                this.setCompletionStatus();
            }
        },

        showControls: function() {
            var hasAccessibility = Adapt.config.has('_accessibility') && Adapt.config.get('_accessibility')._isActive
                ? true
                : false;

            if (hasAccessibility) {
                if (!this.mediaElement.player) return;

                var player = this.mediaElement.player;

                player.options.alwaysShowControls = true;
                player.options.hideVideoControlsOnLoad = false;
                player.enableControls();
                player.showControls();

                this.$('.mejs-playpause-button button').attr({
                    "role": "button"
                });
                var screenReaderVideoTagFix = $("<div role='region' aria-label='.'>");
                this.$('.mejs-playpause-button').prepend(screenReaderVideoTagFix);

                this.$('.mejs-time, .mejs-time-rail').attr({
                    "aria-hidden": "true"
                });
            }
        },

        setVideoVolume: function() {
          if(Adapt.audio.audioStatus == 1){
            if(this.model.has('_startVolume')) {
              this.mediaElement.player.setVolume(parseInt(this.model.get('_startVolume'))/100);
            } else {
              this.mediaElement.player.setVolume(this.mediaElement.player.options.startVolume);
            }
          } else {
            this.mediaElement.player.setVolume(0);
          }
        },

        initNotify: function() {
          if(this.isPopupOpen) return;

          Adapt.trigger("notify:popup", {
            title: this.model.get('_transcript').inlineTranscriptButton,
            body: this.model.get('_transcript').inlineTranscriptBody
          });

          this.isPopupOpen = true;

          if (this.model.get('_transcript')._setCompletionOnView !== false) {
            this.setCompletionStatus();
          }

          Adapt.once("notify:closed", _.bind(function() {
            this.isPopupOpen = false;
          }, this));
        },

        setupSubtitlesMenu: function() {
          var langs = this.model.get('_media').cc;
          var numLangs = langs.length;

          var langArray = new Array();
          var srclangArray = new Array();

          for (var i = 0; i < numLangs; i++) {
            srclangArray[i] = langs[i].srclang;
            langArray[i] = mejs.language.codes[srclangArray[i]];
            this.$('.media-subtitles-option-title').eq(i+1).html(langArray[i]);
          }
        },

        onSubtitlesClicked: function() {
          if ($('html').is(".ie8") || $('html').is(".iPhone.version-7\\.0")) {
            this.$(".media-subtitles-options").css("display", "block");
          } else {
            this.$('.media-subtitles-options').slideToggle(300);
          }
        },

        onSubtitlesOptionClicked: function(event) {
          if (event) event.preventDefault();

          var $link = $(event.currentTarget);
          var lang = $link.attr('srclang');
          this.mediaElement.player.setTrack(lang);

          // Update mediaplayer CC menu
          this.$(".mejs-captions-selector").find("input[type=checkbox]").prop("checked", false);
          this.$(".mejs-captions-selector").find("input[value="+lang+"]").prop("checked",true);

          this.resetSubtitlesMenu();

          $link.find(".media-subtitles-option-icon").removeClass("icon-radio-unchecked");
          $link.find(".media-subtitles-option-icon").addClass("icon-radio-checked");

          if ($('html').is(".ie8") || $('html').is(".iPhone.version-7\\.0")) {
            this.$(".media-subtitles-options").css("display", "none");
          } else {
            this.$('.media-subtitles-options').slideToggle(300);
          }
        },

        setupSubtitles: function() {
          var lang = this.model.get('_startLanguage') === undefined ? 'en' : this.model.get('_startLanguage');

          var $link = this.$(".media-subtitles-options").find("button[srclang="+lang+"]");

          // Update item menu
          $link.find(".media-subtitles-option-icon").removeClass("icon-radio-unchecked");
          $link.find(".media-subtitles-option-icon").addClass("icon-radio-checked");

          this.setupSubtitlesMenu();
        },

        updateSubtitlesOption: function(lang) {
          var $link = this.$(".media-subtitles-options").find("button[srclang="+lang+"]");

          this.resetSubtitlesMenu();

          $link.find(".media-subtitles-option-icon").removeClass("icon-radio-unchecked");
          $link.find(".media-subtitles-option-icon").addClass("icon-radio-checked");
        },

        resetSubtitlesMenu:function () {
          this.$(".media-subtitles-option-icon").removeClass("icon-radio-checked");
          this.$(".media-subtitles-option-icon").removeClass("icon-radio-unchecked");
          this.$(".media-subtitles-option-icon").addClass("icon-radio-unchecked");
        },

        onMediaElementCaptionsChange: function() {
          var player = this.mediaElement.player;
          // Delay so the var has time to update
          _.delay(_.bind(function() {
            if (player.selectedTrack === null) {
  						lang = 'none';
  					} else {
  						lang = player.selectedTrack.srclang;
  					}
            this.updateSubtitlesOption(lang);
          }, this), 400);
        }

    });

    Adapt.register('media-autoplay', MediaAutoplay);

    return MediaAutoplay;

});
