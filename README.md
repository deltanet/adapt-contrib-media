# adapt-media-autoplay

<img src="https://github.com/adaptlearning/documentation/blob/master/04_wiki_assets/plug-ins/images/media02.gif" alt="image of media component" align="right">  

**Media Autoplay** is a *community component* for the [Adapt framework](https://github.com/adaptlearning/adapt_framework).

It is a media playback component for audio and video. It uses HTML5 audio and video for browsers that support it and Flash/Silverlight fallbacks for browsers that don't.  

The component uses [MediaElement.js (v2.21.2)](http://mediaelementjs.com/), a player with a number of useful features including subtitles and accessible (and CSS-skinnable) controls. [MediaElement.js](https://github.com/johndyer/mediaelement) carries the MIT license compatible with Adapt.  

This component impliments an autoplay feature on top of the Adapt core media component. See the core media component wiki [Visit the **Media** wiki](https://github.com/adaptlearning/adapt-contrib-media/wiki) for more information about its functionality and for explanations of key properties.  

[Visit the **Media** wiki](https://github.com/adaptlearning/adapt-contrib-media/wiki) for more information about its functionality and for explanations of key properties.  

## Installation

This plugin must be installed manually.


<div float align=right><a href="#top">Back to Top</a></div>

## Settings Overview

The attributes listed below are used in *components.json* to configure **Media**, and are properly formatted as JSON in [*example.json*](https://github.com/adaptlearning/adapt-contrib-media/blob/master/example.json). Visit the [**Media** wiki](https://github.com/adaptlearning/adapt-contrib-media/wiki) for more information about how they appear in the [authoring tool](https://github.com/adaptlearning/adapt_authoring/wiki).

### Attributes

[**core model attributes**](https://github.com/adaptlearning/adapt_framework/wiki/Core-model-attributes): These are inherited by every Adapt component. [Read more](https://github.com/adaptlearning/adapt_framework/wiki/Core-model-attributes).

**_component** (string): This value must be: `media`.

**_classes** (string): CSS class name to be applied to **Media**’s containing div. The class must be predefined in one of the Less files. Separate multiple classes with a space.

**_layout** (string): This defines the horizontal position of the component in the block. Acceptable values are `full`, `left` or `right`.  

**instruction** (string): This optional text appears above the component. It is frequently used to
guide the learner’s interaction with the component.  

**_setCompletionOn** (string): This determines when Adapt will register this component as having been completed by the user. Acceptable values are `inview` (triggered when the component is fully displayed within the viewport), `play` (triggered when playback is initiated), or `ended` (triggered when the video has reached the end of playback).

**_autoPlay** (boolean): If set to `true`, the video will autoplay. Will behave differently on mobile devices where user interaction may be reqired to start play.

**_useClosedCaptions** (boolean): If set to `true`, video will allow for Closed Captions and the **cc** object will be required. The default is `false`.  

**_showCaptionsButton** (boolean): If set to `true`, video will show a button to control the Closed Captions. The default is `false`.  

**_allowFullScreen** (boolean): Determines whether fullscreen mode is available or not. Note that changing this setting has no effect in Internet Explorer 9 as this browser does not support fullscreen mode for HTML video.  

**_playsinline** (boolean): If set to `true`, videos will play 'inline' on iPhones (the same way they do on iPads). Note that this feature is only available in iOS10 and above. The default is `false`.    

**_preventForwardScrubbing** (boolean): If enabled, will attempt to prevent users from skipping ahead in media (audio/video) unless '_isComplete' is marked as 'true'.  Users can skip backwards, and back up to the maxViewed time tracked by updateTime. Note: This does not apply to full screen iOS users and IE users may be able to circumvent this rule by using video play speed options in browser.  

**_startLanguage** (string): If using closed captions with multiple languages, use this property to specify which language should be shown by default. The value of this property must match one of the **srclang** values.  

**_showVolumeControl** (boolean): If enabled, the volume control will appear in the media player (Not supported on mobile devices)

**_showReplayOverlay** (boolean): When enabled, the play button will be replaced with a replay button.

**_startVolume** (string): Defines the default volume as a percentage (Not supported on mobile devices).  This can be set with or without the percentage sign in the string

**_media** (object): The media attributes group will contain different values depending on the type of media: video or audio.
For video it contains values for **mp4**, **webm**, **ogv**, **poster**, and **cc**. The properties **mp4**, **webm** and **ogv** are all optional, but at least one is required (see below for alternate properties for YouTube/Vimeo video).  
For audio it contains **mp3** and **ogg**. As with video, both are optional, but at least one is required.  
The decision to include more than one file format is typically based on the browser/s used by the target audience. The most widely supported video file format is [mp4](http://caniuse.com/#feat=mpeg4) (specifically [H.264/MPEG-4 Part 10 AVC](https://en.wikipedia.org/wiki/H.264/MPEG-4_AVC)). The most widely supported audio format is mp3.

>**mp4** (string): File name (including path) of the video file. Path should be relative to the *src* folder (e.g., *course/en/video/video-1.mp4*).

>**webm** (string): File name (including path) of the video file. Path should be relative to the *src* folder (e.g., *course/en/video/video-1.webm*).

>**ogv** (string): File name (including path) of the video file. Path should be relative to the *src* folder (e.g., *course/en/video/video-1.ogv*).

>**poster** (string): File name (including path) of the optional image to be shown while the video is downloading, or until the user hits the play button. If this is not included, the first frame of the video will be used instead. Path should be relative to the *src* folder (e.g., *course/en/images/video-1.jpg*).

>**cc** (array):  Closed captions in multiple languages may be provided. Each object in this list contains values for **srclang** and **src**.

>>**srclang** (string): The language of the closed captions (e.g., `en` for English). Acceptable values can be found at http://www.w3schools.com/tags/ref_language_codes.asp.

>>**src** (string): File name (including path) of the closed captions resource accepted by `<track>` (i.e., [the VTT file](https://developer.mozilla.org/en-US/docs/Web/API/Web_Video_Text_Tracks_Format)). Path should be relative to the *src* folder (e.g., *course/en/video/big_buck_bunny_sub.vtt*).

>**mp3** (string): File name (including path) of the audio file. Path should be relative to the *src* folder (e.g., *course/en/audio/audio-1.mp3*).

>**ogg** (string): File name (including path) of the audio file. Path should be relative to the *src* folder (e.g., *course/en/audio/audio-1.ogg*).

**_videoInstruction** (object):  The video instruction attributes group contains values for **_isEnabled**, **_position**, **_hideOnRevisit**, **_first**, and **_revisit**.

>**_isEnabled** (boolean): This determines if the video instruction functionality is used. This is false by default.

>**_position** (number): This sets the verticle position of the instruction area from the top of the video as a percentage.

>**_hideOnRevisit** (boolean): If set to True the instruction area will be hidden on re-visit.

>**_first** (object):  The first attributes group contains values for **start**, and **end**.

>>**start** (string): This text appears as the instruction text at the start of the video on first visit. If no text is provided, the instruction area will be hidden.

>>**end** (string): This text appears as the instruction text at the end of the video on first visit. If no text is provided, the instruction area will be hidden.

>**_revisit** (object):  The revisit attributes group contains values for **start**, and **end**.

>>**start** (string): This text appears as the instruction text at the start of the video on revisit. If no text is provided, the instruction area will be hidden.

>>**end** (string): This text appears as the instruction text at the end of the video on revisit. If no text is provided, the instruction area will be hidden.

**_transcript** (object):  The transcript attributes group contains values for **_isEnabled**, **_setCompletionOnView**, **_inlineTranscript**, **_externalTranscript**, **inlineTranscriptButton**, **inlineTranscriptCloseButton**, **inlineTranscriptTitle**, **inlineTranscriptBody**, **transcriptLinkButton**, and **transcriptLink**.

>**_isEnabled** (boolean): This determines if the video transcript functionality is used. This is false by default.

>**_setCompletionOnView** (boolean): This determines if Adapt will register this component as having been completed by the user when the inline transcript is opened. This is true by default.

>**_inlineTranscript** (boolean): Determines whether the button that toggles the display of the inline transcript text will be displayed or not.

>**_externalTranscript** (boolean): Determines whether the button that links to the optional external transcript will be displayed or not.

>**inlineTranscriptButton** (string): This text appears on the button that toggles the visibility of the inline transcript text. It is displayed when the inline transcript text is hidden. If no text is provided, the **transcriptLink** will be displayed on the button.

>**inlineTranscriptCloseButton** (string): This text appears on the button that toggles the visibility of the inline transcript. It is displayed when the inline transcript text is visible.

>**inlineTranscriptTitle** (string): This optional text appears as the notify title for the transcript.

>**inlineTranscriptBody** (string): This optional text appears as the notify body for the transcript.

>**transcriptLinkButton** (string): This text appears on the button that links to the optional external transcript. If no text is provided, the **transcriptLink** will be displayed on the button.

>**transcriptLink** (string): File name (including path) of the optional external transcript. Path should be relative to the *src* folder (e.g., *course/en/pdf/video01_transcript.pdf*).  

**_playerOptions** (object): This optional object can be used to customize the player. Visit the [MediaElement website](http://mediaelementjs.com/#options) for a list of what options are available. Options are configured in components.json. See [*example.json*](https://github.com/adaptlearning/adapt-contrib-media/blob/master/example.json) for a suggested configuration.
>**Note:**  
>The **_playerOptions** feature is experimental. As these settings are not implemented by the Adapt community, there is no guarantee that all features and combinations thereof will be compatible with your device set up.    

<div float align=right><a href="#top">Back to Top</a></div>

### JSON Examples  

The attributes described above focus on the component's use with standard video. They are properly formatted as JSON in [*example.json*](https://github.com/adaptlearning/adapt-contrib-media/blob/master/example.json) The same model can be applied to the component's use with audio and YouTube videos.     

**Standard video example:**
```json
"_media": {
	"mp4": "course/en/video/video.mp4"
},
```

**YouTube video example:**
```json
"_media": {
  "source": "//www.youtube.com/watch?v=RT-KmgAgxuo",
  "type": "video/youtube"
},
```  

**Vimeo video example:**
```json
"_media": {
  "source": "//player.vimeo.com/video/96961553",
  "type": "video/vimeo"
},
```  

**Audio example:**
```json
"_media": {
  "mp3": "course/en/audio/audio.mp3",
  "ogg": "course/en/audio/audio.ogg"
},
```  

### Accessibility
**Media** has two elements that have been assigned a label using the [aria-label](https://github.com/adaptlearning/adapt_framework/wiki/Aria-Labels) attribute: **ariaRegion** and **transcriptButton**. These labels are not visible elements. They are utilized by assistive technology such as screen readers. Should the label texts need to be customised, they can be found within the **globals** object in [*properties.schema*](https://github.com/adaptlearning/adapt-contrib-media/blob/master/properties.schema).   
<div float align=right><a href="#top">Back to Top</a></div>

## Events
Whenever playback is initiated, the component will emit a `media:stop` event to notify other plugins that make use of audio or video that they should stop playback.

## Limitations

Users of Internet Explorer v8  will need to have [Adobe Flash Player](https://get.adobe.com/flashplayer/) v10 (or better) or Microsoft [Silverlight](https://www.microsoft.com/getsilverlight/get-started/install/) installed to enable media playback, due to that browser's lack of support for HTML audio/video.

Browser | Limitation |
--------- | :----------- |
Chrome   | No known issues.
FireFox | No known issues.
iOS/iPad | No known issues.
Android | FireFox 33.1 with Vimeo: 'This video can't be played with your current setup'.
Edge | No known issues.
IE11 | No known issues.
IE10 | No known issues.
IE9 | Vimeo: ‘Sorry this video does not exist’.  
IE8 | <ul><li>Due to the lack of support for HTML audio/video, users will need to have [Adobe Flash Player](https://get.adobe.com/flashplayer/) v10 (or better) or Microsoft [Silverlight](https://www.microsoft.com/getsilverlight/get-started/install/) installed to enable media playback.</li><li>YouTube: control bar missing</li><li>YouTube/Vimeo: doesn’t track play/ended events</li></ul>

----------------------------
**Version number:**  2.1.6  
**Framework versions:** 2.0  
**Author / maintainer:** Deltanet, plus forked code from Adapt Core Team, [contributors](https://github.com/deltanet/adapt-media-autoplay/graphs/contributors)  
**Accessibility support:** To be reviewed.  
**RTL support:** yes  
**Cross-platform coverage:** Chrome, Chrome for Android, Firefox (ESR + latest version), IE 11, IE10, IE9, IE8, IE Mobile 11, Safari for iPhone (iOS 7+8), Safari for iPad (iOS 7+8), Safari 8, Opera     
**Authoring tool support:** yes  
