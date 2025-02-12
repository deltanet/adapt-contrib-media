import Adapt from 'core/js/adapt';
import ComponentView from 'core/js/views/componentView';
import 'libraries/mediaelement-and-player';
import 'libraries/mediaelement-fullscreen-hook';

/*
 * Default shortcut keys trap a screen reader user inside the player once in focus. These keys are unnecessary
 * as one may traverse the player in a linear fashion without needing to know or use shortcut keys. Below is
 * the removal of the default shortcut keys.
 *
 * The default seek interval functions are passed two different data types from mejs which they handle incorrectly. One
 * is a duration integer the other is the player object. The default functions error on slider key press and so break
 * accessibility. Below is a correction.
 */
Object.assign(window.mejs.MepDefaults, {
  keyActions: [],
  defaultSeekForwardInterval: duration => {
    if (typeof duration === 'object') return duration.duration * 0.05;
    return duration * 0.05;
  },
  defaultSeekBackwardInterval: duration => {
    if (typeof duration === 'object') return duration.duration * 0.05;
    return duration * 0.05;
  }
});

// The following function is used to to prevent a memory leak in Internet Explorer
// See: http://javascript.crockford.com/memory/leak.html
const purge = function (d) {
  let a = d.attributes;
  if (a) {
    for (let i = a.length - 1; i >= 0; i -= 1) {
      const n = a[i].name;
      if (typeof d[n] === 'function') {
        d[n] = null;
      }
    }
  }
  a = d.childNodes;
  if (a) {
    for (let i = 0, count = a.length; i < count; i += 1) {
      purge(d.childNodes[i]);
    }
  }
};

class MediaAutoplayView extends ComponentView {

  events() {
    return {
      'click .media-inline-transcript-button': 'initNotify',
      'click .media-external-transcript-button': 'onExternalTranscriptClicked',
      'click .js-skip-to-transcript': 'onSkipToTranscript',
      'click .media-subtitles-button': 'onSubtitlesClicked',
      'click .media-subtitles-option': 'onSubtitlesOptionClicked',
      'click .mejs-captions-selector': 'onMediaElementCaptionsChange'
    };
  }

  className() {
    let classes = super.className();
    const playerOptions = this.model.get('_playerOptions');
    if (playerOptions?.toggleCaptionsButtonWhenOnlyOne) {
      classes += ' toggle-captions';
    }
    return classes;
  }

  preRender() {
    this.listenTo(this.model, 'change:_isComplete', this.checkCompletion);

    this.listenTo(Adapt, {
      'device:resize': this.onScreenSizeChanged,
      'device:changed': this.onDeviceChanged,
      'media:stop': this.onMediaStop,
      'popup:opened': this.notifyOpened,
      'popup:closed': this.notifyClosed,
      'audio:updateAudioStatus': this.setVideoVolume
    });

    _.bindAll(this, 'onMediaElementPlay', 'onMediaElementPause', 'onMediaElementEnded', 'onMediaElementTimeUpdate', 'onMediaElementSeeking');

    // set initial player state attributes
    this.model.set({
      '_isMediaEnded': false,
      '_isMediaPlaying': false
    });

    this.firstRun = true;
    this.notifyIsOpen = false;
    this.videoIsInView = false;
    this.onscreenTriggered = false;

    if (this.model.get('_media').source) {
      const media = this.model.get('_media');

      // Avoid loading of Mixed Content (insecure content on a secure page)
      if (window.location.protocol === 'https:' && media.source.indexOf('http:') === 0) {
        media.source = media.source.replace(/^http\:/, 'https:');
      }

      this.model.set('_media', media);
    }

    this.checkIfResetOnRevisit();
  }

  postRender() {
    this.setupPlayer();
    this.addMejsButtonClass();
    // Set up instructions
    if (this.model.has('_videoInstruction')) {
      if (this.model.get('_videoInstruction')._isEnabled) {
        this.setupInstructions();
      }
    }
  }

  addMejsButtonClass() {
    this.$('.mejs-overlay-button').addClass('icon');
  }

  setupPlayer() {
    if (!this.model.get('_playerOptions')) this.model.set('_playerOptions', {});

    const modelOptions = this.model.get('_playerOptions');

    if (modelOptions.pluginPath === undefined) {
      // on the off-chance anyone still needs to use the Flash-based player...
      _.extend(modelOptions, {
        pluginPath: 'https://cdnjs.cloudflare.com/ajax/libs/mediaelement/2.21.2/',
        flashName: 'flashmediaelement-cdn.swf',
        flashScriptAccess: 'always'
      });
    }

    if (modelOptions.features === undefined) {
      modelOptions.features = ['playpause', 'progress', 'current', 'duration'];
      if (this.model.get('_useClosedCaptions')) {
        modelOptions.features.unshift('tracks');
      }
      if (this.model.get('_allowFullScreen')) {
        modelOptions.features.push('fullscreen');
      }
      if (this.model.get('_showVolumeControl')) {
        modelOptions.features.push('volume');
      }
    }

    /*
    Unless we are on Android/iOS and using native controls, when MediaElementJS initializes the player
    it will invoke the success callback prior to performing one last call to setPlayerSize.
    This call to setPlayerSize is deferred by 50ms so we add a delay of 100ms here to ensure that
    we don't invoke setReadyStatus until the player is definitely finished rendering.
    */
    modelOptions.success = _.debounce(this.onPlayerReady.bind(this), 100);

    if (this.model.get('_useClosedCaptions')) {
      const startLanguage = this.model.get('_startLanguage') || 'en';
      if (!Adapt.offlineStorage.get('captions')) {
        Adapt.offlineStorage.set('captions', startLanguage);
      }
      modelOptions.startLanguage = this.checkForSupportedCCLanguage(Adapt.offlineStorage.get('captions'));

      if (this.model.get('_showCaptionsButton')) {
        this.setupSubtitles();
      }
    }

    if (modelOptions.alwaysShowControls === undefined) {
      modelOptions.alwaysShowControls = false;
    }
    if (modelOptions.hideVideoControlsOnLoad === undefined) {
      modelOptions.hideVideoControlsOnLoad = true;
    }

    this.addMediaTypeClass();

    this.addThirdPartyFixes(modelOptions, () => {
      // create the player
      this.$('audio, video').mediaelementplayer(modelOptions);
      this.cleanUpPlayer();

      const _media = this.model.get('_media');
      // if no media is selected - set ready now, as success won't be called
      if (!_media.mp3 && !_media.mp4 && !_media.ogv && !_media.webm && !_media.source) {
        Adapt.log.warn('ERROR! No media is selected in components.json for component ' + this.model.get('_id'));
        this.setReadyStatus();
        return;
      }
      // Check if we're streaming
      if (_media.source) {
        this.$('.media-autoplay__widget').addClass('external-source');
      }
    });

    this.mediaAutoplayOnce = this.model.get('_autoPlayOnce');
    this.mediaCanAutoplay = this.model.get('_autoPlay');

    this.setVideoVolume();

    // Check if notify is visible
    if ($('html').hasClass('notify')) {
      this.notifyOpened();
    }

    this.$('.component__widget').on('onscreen', _.bind(this.onscreen, this));
  }

  addMediaTypeClass() {
    const media = this.model.get('_media');
    if (media?.type) {
      const typeClass = media.type.replace(/\//, '-');
      this.$('.media-autoplay__widget').addClass(typeClass);
    }
  }

  addThirdPartyFixes(modelOptions, callback) {
    const media = this.model.get('_media');
    if (!media) return callback();

    switch (media.type) {
      case 'video/vimeo':
        modelOptions.alwaysShowControls = false;
        modelOptions.hideVideoControlsOnLoad = true;
        modelOptions.features = [];
        if (MediaView.froogaloopAdded) return callback();
        $.getScript('assets/froogaloop.js')
          .done(() => {
            MediaView.froogaloopAdded = true;
            callback();
          })
          .fail(() => {
            MediaView.froogaloopAdded = false;
            console.log('Could not load froogaloop.js');
          });
        break;
      default:
        callback();
    }
  }

  cleanUpPlayer() {
    this.$('.media-autoplay__widget').children('.mejs-offscreen').remove();
    this.$('[role=application]').removeAttr('role tabindex');
    this.$('[aria-controls]').removeAttr('aria-controls');
  }

  setupEventListeners() {
    this.completionEvent = (this.model.get('_setCompletionOn') || 'play');

    if (this.completionEvent === 'inview') {
      this.setupInviewCompletion('.component__widget');
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

    // occasionally the mejs code triggers a click of the captions language
    // selector during setup, this slight delay ensures we skip that
    _.delay(this.listenForCaptionsChange.bind(this), 250);
  }

  /**
   * Sets up the component to detect when the user has changed the captions so that it can store the user's
   * choice in offlineStorage and notify other media components on the same page of the change
   * Also sets the component up to listen for this event from other media components on the same page
   */
  listenForCaptionsChange() {
    if (!this.model.get('_useClosedCaptions')) return;

    const selector = this.model.get('_playerOptions').toggleCaptionsButtonWhenOnlyOne ?
      '.mejs-captions-button button' :
      '.mejs-captions-selector';

    this.$(selector).on('click.mediaCaptionsChange', _.debounce(() => {
      const srclang = this.mediaElement.player.selectedTrack ? this.mediaElement.player.selectedTrack.srclang : 'none';
      Adapt.offlineStorage.set('captions', srclang);
      Adapt.trigger('media:captionsChange', this, srclang);
    }, 250)); // needs debouncing because the click event fires twice

    this.listenTo(Adapt, 'media:captionsChange', this.onCaptionsChanged);
  }

  /**
   * Handles updating the captions in this instance when learner changes captions in another
   * media component on the same page
   * @param {Backbone.View} view The view instance that triggered the event
   * @param {string} lang The captions language the learner chose in the other media component
   */
  onCaptionsChanged(view, lang) {
    if (view?.cid === this.cid) return; // ignore the event if we triggered it

    lang = this.checkForSupportedCCLanguage(lang);

    this.mediaElement.player.setTrack(lang);

    // because calling player.setTrack doesn't update the cc button's languages popup...
    const $inputs = this.$('.mejs-captions-selector input');
    $inputs.filter(':checked').prop('checked', false);
    $inputs.filter('[value="' + lang + '"]').prop('checked', true);
  }

  /**
   * When the learner selects a captions language in another media component, that language may not be available
   * in this instance, in which case default to the `_startLanguage` if that's set - or "none" if it's not
   * @param {string} lang The language we're being asked to switch to e.g. "de"
   * @return {string} The language we're actually going to switch to - or "none" if there's no good match
   */
  checkForSupportedCCLanguage(lang) {
    if (!lang || lang === 'none') return 'none';

    if (_.findWhere(this.model.get('_media').cc, { srclang: lang })) return lang;

    return this.model.get('_startLanguage') || 'none';
  }

  onMediaElementPlay(event) {
    this.queueGlobalEvent('play');

    Adapt.trigger('audio:stopAllChannels');
    Adapt.trigger('media:stop', this);

    if (this.model.get('_pauseWhenOffScreen')) $(this.mediaElement).on('inview', this.onMediaElementInview);

    this.model.set({
      '_isMediaPlaying': true,
      '_isMediaEnded': false
    });

    if (this.completionEvent === 'play') {
      this.setCompletionStatus();
    }

    if (this.model.has('_videoInstruction')) {
      if (this.model.get('_videoInstruction')._isEnabled) {
        this.hideInstruction();
      }
    }
  }

  onMediaElementPause(event) {
    this.queueGlobalEvent('pause');

    $(this.mediaElement).off('inview', this.onMediaElementInview);

    this.model.set('_isMediaPlaying', false);
  }

  onMediaElementEnded(event) {
    this.queueGlobalEvent('ended');

    this.model.set('_isMediaEnded', true);

    if (this.model.has('_showReplayOverlay') && this.model.get('_showReplayOverlay')) {
      this.$('.mejs-overlay-button').addClass('replay');
    }

    if (this.completionEvent === 'ended') {
      this.setCompletionStatus();
    }

    if (this.firstRun) {
      if (this.model.has('_videoInstruction')) {
        if (this.model.get('_videoInstruction')._isEnabled) {
          this.changeInstructionEnd();
        }
      }
    }
    this.firstRun = false;
  }

  onMediaElementInview(event, isInView) {
    if (!isInView && !event.currentTarget.paused) event.currentTarget.pause();
  }

  onMediaElementSeeking(event) {
    let maxViewed = this.model.get('_maxViewed');
    if (!maxViewed) {
      maxViewed = 0;
    }
    if (event.target.currentTime > maxViewed) {
      event.target.currentTime = maxViewed;
    }
  }

  onMediaElementTimeUpdate(event) {
    let maxViewed = this.model.get('_maxViewed');
    if (!maxViewed) {
      maxViewed = 0;
    }
    if (event.target.currentTime > maxViewed) {
      this.model.set('_maxViewed', event.target.currentTime);
    }
  }

  // Overrides the default play/pause functionality to stop accidental playing on touch devices
  setupPlayPauseToggle() {
    // bit sneaky, but we don't have a this.mediaElement.player ref on iOS devices
    const player = this.mediaElement.player;

    if (!player) {
      console.log('MediaAutoplay.setupPlayPauseToggle: OOPS! there is no player reference.');
      return;
    }

    // stop the player dealing with this, we'll do it ourselves
    player.options.clickToPlayPause = false;

    this.onOverlayClick = this.onOverlayClick.bind(this);
    this.onMediaElementClick = this.onMediaElementClick.bind(this);

    // play on 'big button' click
    this.$('.mejs-overlay-button').on('click', this.onOverlayClick);

    // pause on player click
    this.$('.mejs-mediaelement').on('click', this.onMediaElementClick);
  }

  onMediaStop(view) {
    // Make sure this view isn't triggering media:stop
    if (view?.cid === this.cid) return;

    if (!this.mediaElement || !this.mediaElement.player) return;

    this.mediaElement.player.pause();

  }

  onOverlayClick() {
    const player = this.mediaElement.player;
    if (!player) return;

    player.play();
  }

  onMediaElementClick(event) {
    const player = this.mediaElement.player;
    if (!player) return;

    const isPaused = player.media.paused;
    if (!isPaused) player.pause();
  }

  checkIfResetOnRevisit() {
    const isResetOnRevisit = this.model.get('_isResetOnRevisit');

    if (isResetOnRevisit) {
      this.model.reset(isResetOnRevisit);
    }
  }

  remove() {
    this.$('.mejs-overlay-button').off('click', this.onOverlayClick);
    this.$('.mejs-mediaelement').off('click', this.onMediaElementClick);

    if (this.model.get('_useClosedCaptions')) {
      const selector = this.model.get('_playerOptions').toggleCaptionsButtonWhenOnlyOne ?
        '.mejs-captions-button button' :
        '.mejs-captions-selector';
      this.$(selector).off('click.mediaCaptionsChange');
    }

    const modelOptions = this.model.get('_playerOptions');
    delete modelOptions.success;

    const media = this.model.get('_media');
    if (media) {
      switch (media.type) {
        case 'video/vimeo':
          this.$('iframe')[0].isRemoved = true;
      }
    }

    if (this.mediaElement && this.mediaElement.player) {
      const playerId = this.mediaElement.player.id;

      purge(this.$el[0]);
      this.mediaElement.player.remove();

      if (window.mejs.players[playerId]) {
        delete window.mejs.players[playerId];
      }
    }

    if (this.mediaElement) {
      $(this.mediaElement).off({
        'play': this.onMediaElementPlay,
        'pause': this.onMediaElementPause,
        'ended': this.onMediaElementEnded,
        'seeking': this.onMediaElementSeeking,
        'timeupdate': this.onMediaElementTimeUpdate,
        'inview': this.onMediaElementInview
      });

      this.mediaElement.src = '';
      $(this.mediaElement.pluginElement).remove();
      delete this.mediaElement;
    }

    ComponentView.prototype.remove.call(this);
  }

  onDeviceChanged() {
    if (this.model.get('_media').source) {
      this.$('.mejs-container').width(this.$('.component__widget').width());
    }
    this.positionInstruction();
  }

  onPlayerReady(mediaElement, domObject) {
    this.mediaElement = mediaElement;

    let player = this.mediaElement.player;
    if (!player) player = window.mejs.players[this.$('.mejs-container').attr('id')];

    const hasTouch = window.mejs.MediaFeatures.hasTouch;
    if (hasTouch) {
      this.setupPlayPauseToggle();
    }

    this.addThirdPartyAfterFixes();
    this.cleanUpPlayerAfter();
    this.setReadyStatus();
    this.setupEventListeners();
    this.setVideoVolume();
  }

  addThirdPartyAfterFixes() {
    const media = this.model.get('_media');
    switch (media.type) {
      case 'video/vimeo':
        this.$('.mejs-container').attr('tabindex', 0);
    }
  }

  cleanUpPlayerAfter() {
    this.$("[aria-valuemax='NaN']").attr('aria-valuemax', 0);
  }

  onScreenSizeChanged() {
    this.$('audio, video').width(this.$('.component__widget').width());
    this.positionInstruction();
  }

  onSkipToTranscript() {
    // need slight delay before focussing button to make it work when JAWS is running
    // see https://github.com/adaptlearning/adapt_framework/issues/2427
    _.delay(() => {
      this.$('.media-inline-transcript-button').a11y_focus();
    }, 250);
  }

  onToggleInlineTranscript(event) {
    if (event) event.preventDefault();
    const $transcriptBodyContainer = this.$('.media-autoplay__transcript-body-inline');
    const $button = this.$('.media-autoplay__transcript-btn-inline');
    const $buttonText = this.$('.media-autoplay__transcript-btn-inline .media-autoplay__transcript-btn-text');

    if ($transcriptBodyContainer.hasClass('inline-transcript-open')) {
      $transcriptBodyContainer.stop(true, true).slideUp(() => {
        $(window).resize();
      });
      $button.attr('aria-expanded', false);
      $transcriptBodyContainer.removeClass('inline-transcript-open');
      $buttonText.html(this.model.get('_transcript').inlineTranscriptButton);
    } else {
      $transcriptBodyContainer.stop(true, true).slideDown(() => {
        $(window).resize();
      });
      $button.attr('aria-expanded', true);
      $transcriptBodyContainer.addClass('inline-transcript-open');
      $buttonText.html(this.model.get('_transcript').inlineTranscriptCloseButton);

      if (this.model.get('_transcript')._setCompletionOnView !== false) {
        this.setCompletionStatus();
      }
    }
  }

  onExternalTranscriptClicked(event) {
    if (this.model.get('_transcript')._setCompletionOnView !== false) {
      this.setCompletionStatus();
    }
  }

  /**
   * Queue firing a media event to prevent simultaneous events firing, and provide a better indication of how the
   * media  player is behaving
   * @param {string} eventType
   */
  queueGlobalEvent(eventType) {
    const time = Date.now();
    const lastEvent = this.lastEvent || { time: 0 };
    const timeSinceLastEvent = time - lastEvent.time;
    const debounceTime = 500;

    this.lastEvent = {
      time,
      type: eventType
    };

    // Clear any existing timeouts
    clearTimeout(this.eventTimeout);

    // Always trigger 'ended' events
    if (eventType === 'ended') {
      return this.triggerGlobalEvent(eventType);
    }

    // Fire the event after a delay, only if another event has not just been fired
    if (timeSinceLastEvent > debounceTime) {
      this.eventTimeout = setTimeout(this.triggerGlobalEvent.bind(this, eventType), debounceTime);
    }
  }

  triggerGlobalEvent(eventType) {
    const player = this.mediaElement.player;

    const eventObj = {
      type: eventType,
      src: this.mediaElement.src,
      platform: this.mediaElement.pluginType
    };

    if (player) eventObj.isVideo = player.isVideo;

    Adapt.trigger('media', eventObj);
  }

  notifyOpened() {
    this.notifyIsOpen = true;
    this.playMediaElement(false);
  }

  notifyClosed() {
    this.notifyIsOpen = false;

    if (this.videoIsInView && this.mediaCanAutoplay && this.firstRun) {
      _.delay(_.bind(() => {
        this.playMediaElement(true);
      }), 400);
    }
  }

  checkCompletion() {
    // Add check for element for backwards compatability
    if (this.model.has('_videoInstruction')) {
      if (this.model.get('_videoInstruction')._isEnabled && this.model.get('_isComplete')) {
        this.changeInstructionEnd();
      }
    }
  }

  changeInstructionStart() {
    // Check for empty elements
    if (this.instructionStart == '') {
      this.hideInstruction();
    } else {
      this.$('.video-instruction').find('.component-instruction-inner').html(this.instructionStart);
      this.showInstruction();
    }
  }

  changeInstructionEnd() {
    // Check for empty elements
    if (this.instructionEnd == '') {
      this.hideInstruction();
    } else {
      this.$('.video-instruction').find('.component-instruction-inner').html(this.instructionEnd);
      this.showInstruction();
    }
  }

  hideInstruction() {
    this.$('.video-instruction').hide();
  }

  showInstruction() {
    let position = 50;

    if (Adapt.device.screenSize === 'large') {
      position = this.instructionPosition;
    }

    this.$('.media-instruction-container').css('margin-top', -(this.$('.media-instruction-container').outerHeight() / 2));

    this.$('.media-instruction-container').css({ top: (position - 20) + '%' });
    this.$('.video-instruction').show();

    this.$('.media-instruction-container').animate({ top: position + '%' }, 500);
  }

  setupInstructions() {
    // Position instructions
    this.instructionPosition = this.model.get('_videoInstruction')._position;
    this.positionInstruction();
    // Determine start and end instructions based on the completion status
    if (this.model.get('_isComplete')) {
      this.instructionStart = this.model.get('_videoInstruction')._revisit.start;
      this.instructionEnd = this.model.get('_videoInstruction')._revisit.end;
    } else {
      this.instructionStart = this.model.get('_videoInstruction')._first.start;
      this.instructionEnd = this.model.get('_videoInstruction')._first.end;
    }
    // If hidden on revisit
    if ((this.model.get('_isComplete') && this.model.get('_videoInstruction')._hideOnRevisit) || this.mediaCanAutoplay) {
      this.hideInstruction();
    } else {
      this.changeInstructionStart();
    }
  }

  onscreen(event, measurements) {
    _.delay(_.bind(() => {
      // Check if notify is visible
      if ($('body').children('.notify').css('visibility') == 'visible') {
        //this.notifyOpened();
      }

      if ($('html').hasClass('notify')) {
        this.notifyOpened();
      } else {
        this.notifyClosed();
      }

      this.checkOnscreen(measurements);

    }), 500);
  }

  checkOnscreen(measurements) {
    const visible = this.model.get('_isVisible');
    const isOnscreenY = (measurements.percentFromTop < 50) && (measurements.percentFromTop > -10);
    const isOnscreenX = measurements.percentInviewHorizontal == 100;

    if (visible && isOnscreenY && isOnscreenX && !this.onscreenTriggered) {
      this.videoIsInView = true;

      if (!this.notifyIsOpen && this.mediaCanAutoplay) {
        this.playMediaElement(true);
      }
      if (this.model.get('_setCompletionOn') == 'inview') {
        this.setCompletionStatus();
      }

      // Set to true to stop onscreen looping
      this.onscreenTriggered = true;
    }

    // Check when element is off screen
    if (visible && (!isOnscreenY || !isOnscreenX)) {
      this.videoIsInView = false;
      this.onscreenTriggered = false;
      this.playMediaElement(false);
    }
  }

  playMediaElement(state) {
    if (!this.mediaElement) return;

    if (this.model.get('_isVisible') && state && this.videoIsInView) {
      Adapt.trigger('audio:stopAllChannels');
      this.mediaElement.play();
      // Set to false to stop autoplay when onscreen again
      if (this.mediaAutoplayOnce) {
        this.mediaCanAutoplay = false;
      }
      // Trigger again after a delay to catch any audio triggered via scrolling the page quickly
      _.delay(_.bind(() => {
        Adapt.trigger('audio:stopAllChannels');
      }), 500);
    } else if (state === false) {
      this.mediaElement.pause();
    }
  }

  setVideoVolume() {
    if (!this.mediaElement) return;
    // Check for audio extension
    //if (!Adapt.audio) return;
    if (Adapt.course.get('_audio') && Adapt.course.get('_audio')._isEnabled) {
      // If audio is turned on
      if (Adapt.audio.audioStatus == 1) {
        if (this.model.has('_startVolume')) {
          this.mediaElement.player.setVolume(parseInt(this.model.get('_startVolume')) / 100);
        } else {
          this.mediaElement.player.setVolume(this.mediaElement.player.options.startVolume);
        }
      } else {
        this.mediaElement.player.setVolume(0);
      }
    } else {
      if (this.model.has('_startVolume')) {
        this.mediaElement.player.setVolume(parseInt(this.model.get('_startVolume')) / 100);
      } else {
        this.mediaElement.player.setVolume(this.mediaElement.player.options.startVolume);
      }
    }
  }

  updateSubtitlesTrack(lang) {
    this.mediaElement.player.setTrack(lang);
  }

  setupSubtitles() {
    this.captionsAreOn = true;

    const lang = this.model.get('_startLanguage') === undefined ? 'en' : this.model.get('_startLanguage');

    const $link = this.$('.media-subtitles-options').find('button[srclang=' + lang + ']');

    // Update item menu
    $link.find('.media-subtitles-option-icon').removeClass('icon-radio-unchecked');
    $link.find('.media-subtitles-option-icon').addClass('icon-radio-checked');

    this.setupSubtitlesMenu();
  }

  initNotify() {
    if (this.isPopupOpen) return;

    this.isPopupOpen = true;

    if (this.model.get('_transcript')._setCompletionOnView !== false) {
      this.setCompletionStatus();
    }

    Adapt.notify.popup({
      title: this.model.get('_transcript').inlineTranscriptTitle,
      body: this.model.get('_transcript').inlineTranscriptBody,
      _isCancellable: true,
      _showCloseButton: true,
      _closeOnBackdrop: true,
      _classes: ' media-autoplay'
    });

    this.listenToOnce(Adapt, {
      'popup:closed': this.onPopupClosed
    });
  }

  onPopupClosed() {
    this.isPopupOpen = false;
  }

  setupSubtitlesMenu() {
    const langs = this.model.get('_media').cc;
    const numLangs = langs.length;

    let langArray = [];
    let srclangArray = [];

    for (var i = 0; i < numLangs; i++) {
      srclangArray[i] = langs[i].srclang;
      langArray[i] = window.mejs.language.codes[srclangArray[i]];
      this.$('.media-subtitles-option-title').eq(i + 1).html(langArray[i]);
    }
  }

  onSubtitlesClicked() {
    const langs = this.model.get('_media').cc;
    const numLangs = langs.length;

    // Check if only one language is in the list
    if (numLangs < 2) {
      // toggle the css class
      if (this.captionsAreOn) {
        this.$('.media-subtitles-button').addClass('cc-off');
      } else {
        this.$('.media-subtitles-button').removeClass('cc-off');
      }

      this.captionsAreOn = !this.captionsAreOn; // toggle
      let lang = this.captionsAreOn ? this.model.get('_startLanguage') : 'none';
      this.updateSubtitlesTrack(lang);
    } else {
      this.toggleSubtitlesMenu();
    }
  }

  toggleSubtitlesMenu() {
    if ($('html').is('.ie8') || $('html').is('.iPhone.version-7\\.0')) {
      this.$('.media-subtitles-options').css('display', 'block');
    } else {
      this.$('.media-subtitles-options').slideToggle(300);
    }
  }

  onSubtitlesOptionClicked(event) {
    if (event) event.preventDefault();

    const $link = $(event.currentTarget);
    const lang = $link.attr('srclang');

    this.updateSubtitlesTrack(lang);

    // Update mediaplayer CC menu
    this.$('.mejs-captions-selector').find('input[type=checkbox]').prop('checked', false);
    this.$('.mejs-captions-selector').find('input[value=' + lang + ']').prop('checked', true);

    this.resetSubtitlesMenu();

    $link.find('.media-subtitles-option-icon').removeClass('icon-radio-unchecked');
    $link.find('.media-subtitles-option-icon').addClass('icon-radio-checked');

    if ($('html').is('.ie8') || $('html').is('.iPhone.version-7\\.0')) {
      this.$('.media-subtitles-options').css('display', 'none');
    } else {
      this.$('.media-subtitles-options').slideToggle(300);
    }
  }

  updateSubtitlesOption(lang) {
    const $link = this.$('.media-subtitles-options').find('button[srclang=' + lang + ']');

    this.resetSubtitlesMenu();

    $link.find('.media-subtitles-option-icon').removeClass('icon-radio-unchecked');
    $link.find('.media-subtitles-option-icon').addClass('icon-radio-checked');
  }

  resetSubtitlesMenu() {
    this.$('.media-subtitles-option-icon').removeClass('icon-radio-checked');
    this.$('.media-subtitles-option-icon').removeClass('icon-radio-unchecked');
    this.$('.media-subtitles-option-icon').addClass('icon-radio-unchecked');
  }

  positionInstruction() {
    let position = 50;

    if (Adapt.device.screenSize === 'large') {
      position = this.instructionPosition;
    }

    this.$('.media-instruction-container').css({
      top: position + '%',
      width: this.$('.component__widget').width()
    });

    this.$('.media-instruction-container').css('margin-top', -(this.$('.media-instruction-container').outerHeight() / 2));
  }

  onMediaElementCaptionsChange() {
    if (!this.mediaElement) return;
    const player = this.mediaElement.player;
    // Delay so the var has time to update
    _.delay(_.bind(() => {
      if (player.selectedTrack === null) {
        lang = 'none';
      } else {
        lang = player.selectedTrack.srclang;
      }
      this.updateSubtitlesOption(lang);
    }), 400);
  }
}

MediaAutoplayView.froogaloopAdded = false;

export default MediaAutoplayView;
