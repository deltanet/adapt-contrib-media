/*
* adapt-media-autoplay
* License - http://github.com/adaptlearning/adapt_framework/LICENSE
* Maintainers - Dan Gray <dan@delta-net.co.uk>, Chris Steele <chris.steele@kineo.com>, Daryl Hedley <darylhedley@hotmail.com>,
*               Kevin Corry <kevinc@learningpool.com>
*/
define(function(require) {

    var mep = require("components/adapt-media-autoplay/js/mediaelement-and-player.min.js");
    var Adapt = require("coreJS/adapt");
    var ComponentView = require("coreViews/componentView");
    var Handlebars = require('handlebars');

    var MediaAutoplay = ComponentView.extend({

        preRender: function() {
            this.listenTo(Adapt, 'device:resize', this.onScreenSizeChanged);
            this.listenTo(Adapt, 'device:changed', this.onDeviceChanged);
        },

        onScreenSizeChanged: function() {
            this.$('audio, video').width(this.$('.component-widget').width());
        },

        onDeviceChanged: function() {
            if (this.model.get('_media').source) {
                this.$('.mejs-container').width(this.$('.component-widget').width());
            }
        },

        postRender: function() {
            var mediaElement = this.$('audio, video').mediaelementplayer({
                pluginPath:'assets/',
                success: _.bind(function (mediaElement, domObject) {
                    this.mediaElement = mediaElement;
                    this.setReadyStatus();
                    this.setupEventListeners();
                }, this),
                features: ['playpause','progress','current','duration']
            });

            this.$('.component-widget').on('inview', _.bind(this.inview, this));

            // We're streaming - set ready now, as success won't be called above
            if (this.model.get('_media').source) {
                this.$('.media-autoplay-widget').addClass('external-source');
                this.setReadyStatus();
            }
        },

        setupEventListeners: function() {
            this.completionEvent = (!this.model.get('_setCompletionOn')) ? 'play' : this.model.get('_setCompletionOn');
            if (this.completionEvent !== "inview") {
                this.mediaElement.addEventListener(this.completionEvent, _.bind(this.onCompletion, this));
            } else {
                this.$('.component-widget').on('inview', _.bind(this.inview, this));
            }
        },

        inview: function(event, visible, visiblePartX, visiblePartY) {
            if (visible) {
                if (visiblePartY === 'top') {
                    this._isVisibleTop = true;
                } else if (visiblePartY === 'bottom') {
                    this._isVisibleBottom = true;
                } else {
                    this._isVisibleTop = true;
                    this._isVisibleBottom = true;
                }

                if (this._isVisibleTop && this._isVisibleBottom) {
                    // will need to check if accessibility is enabled:
                    //if (this.model.get('_autoPlay') && (Adapt.config.get('_accessibility')._isEnabled === undefined || Adapt.config.get('_accessibility')._isEnabled === true)) {
                    if (this.model.get('_autoPlay')) {
                        this.playMediaElement(true);
                    }
                    this.$('.component-inner').off('inview');
                    this.setCompletionStatus();
                }
                
            } else {
                this.playMediaElement(false);
            }
        },

        playMediaElement: function(state) {
            if (this.model.get('_isVisible') && state) {
                this.mediaElement.play();
            } else if (state === false) {
                this.mediaElement.pause();
            }
        },

        onCompletion: function() {
            this.setCompletionStatus();
            // removeEventListener needs to pass in the method to remove the event in firefox and IE10
            this.mediaElement.removeEventListener(this.completionEvent, this.onCompletion);
        }

    });

    Adapt.register("media-autoplay", MediaAutoplay);

    return MediaAutoplay;

});
