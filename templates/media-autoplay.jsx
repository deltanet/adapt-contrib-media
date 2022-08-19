import Adapt from 'core/js/adapt';
import React from 'react';
import { templates, classes, html, compile } from 'core/js/reactHelpers';

export default function MediaAutoplay(props) {
    const {
        _globals = Adapt.course.get('_globals'),
        _closedCaptionsIcon,
        _component,
        _media,
        _playsinline,
        _showCaptionsButton,
        _transcript,
        _useClosedCaptions,
        _videoInstruction,
        closedCaptionsNoneButton,
        srclang
    } = props;

    const ariaCaptionsLabel = Adapt.a11y.normalize(_globals._components['_media-autoplay'].ariaCaptionsLabel);
    const ariaTranscriptLabel = Adapt.a11y.normalize(_globals._components['_media-autoplay'].ariaTranscriptLabel);
    const skipToTranscript = _globals._components?._media ? Adapt.a11y.normalize(_globals._components?._media?.skipToTranscript) : '';

    function InlineTranscriptButton(props) {
        return (
            <button
                className="options-button media-inline-transcript-button"
                aria-label={ariaTranscriptLabel}
            >
                {_transcript.inlineTranscriptButton}
            </button>
        );
    }

    function InlineTranscriptIconButton(props) {
        return (
            <button
                className="options-button media-inline-transcript-button icon icon-menu"
                aria-label={ariaTranscriptLabel}
            >
            </button>
        );
    }

    function ExternalTranscriptButton(props) {
        return (
            <button
                onclick="window.open('{_transcript.transcriptLink}')"
                className="options-button icon icon-menu media-external-transcript-button">
                <div className="transcript-text-container" />
            </button>
        );
    }

    function SkipToTranscriptButton(props) {
        return (
            <button
                className="aria-label js-skip-to-transcript"
                tabIndex="-1"
                aria-label={skipToTranscript}
            >
            </button>
        );
    }

    function CaptionsButtons(props) {
        return (
            <div className="media-subtitles-container">
                <div className="media-subtitles-button-container">
                    <button
                        className={classes([
                            'options-button icon',
                            _closedCaptionsIcon ? { _closedCaptionsIcon } : 'icon-comment',
                            'media-subtitles-button'
                        ])}
                        aria-label={ariaCaptionsLabel}>
                    </button>
                </div>
                <div className="media-subtitles-options">
                    <button className="media-subtitles-option" srcLang="none">
                        <div className="media-subtitles-option-icon icon icon-radio-unchecked"></div>
                        <div className="media-subtitles-option-title">
                            {closedCaptionsNoneButton ? closedCaptionsNoneButton : 'None'}
                        </div>
                    </button>

                    {_media.cc.map(({ srclang }, index) =>
                        <button className="media-subtitles-option" srcLang={srclang} key={index}>
                            <div className="media-subtitles-option-icon icon icon-radio-unchecked"></div>
                            <div className="media-subtitles-option-title">
                                {srclang}
                            </div>
                        </button>
                    )}
                </div>
            </div>
        );
    }

    function TranscriptButtons(props) {
        return (
            <div className="media-transcript-button-container">
                {_transcript._inlineTranscript
                ?
                    _transcript.inlineTranscriptButton
                    ?
                        <InlineTranscriptButton />
                    :
                        <InlineTranscriptIconButton />
                :
                    <ExternalTranscriptButton />
                }
            </div>
        );
    }

    function AudioElement(props) {
        return (
            <>
                {props.media.mp3 && props.media.poster &&
                    <img className="media_poster is-audio" src={props.media.poster} />
                }

                {props.media.mp3 &&
                    <audio src={props.media.mp3} type="audio/mp3" style="width: 100%; height: 100%;" />
                }

                {props.media.ogg &&
                    <audio src={props.media.ogg} type="audio/ogg" style="width: 100%; height: 100%;" />
                }
            </>
        );
    }

    function VideoElement(props) {
        const videoAttributes = {
            'aria-hidden': "true",
            preload: "none",
            width: "640",
            height: "360",
            playsInline: _playsinline ? true : false,
            poster: props.media.type !== "video/vimeo" ? props.media.poster: null,
            style: {
                width: '100%',
                height: '100%'
            },
            controls: "controls"
        };

        return (
            <video {...videoAttributes}>
                
                {props.media.source ?
                    <source src={props.media.source} type={props.media.type} />
                    :
                    <>
                        {props.media.mp4 &&
                            <source src={props.media.mp4} type="video/mp4" />
                        }

                        {props.media.ogv &&
                            <source src={props.media.ogv} type="video/ogg" />
                        }

                        {props.media.webm &&
                            <source src={props.media.webm} type="video/webm" />
                        }
                    </>
                }

                {_useClosedCaptions &&
                    props.media.cc.map((srclang, src, index) => {
                        <track
                            kind="subtitles"
                            src={src}
                            type="text/vtt"
                            srcLang={srclang} key={index} />
                    })
                }
            </video>
        );
    }

    function InlineTranscript (props) {
        return (
            <div
                className="media-autoplay__transcript-body-inline"
                role="region"
                aria-label={_transcript.inlineTranscriptButton ? _transcript.inlineTranscriptButton : _transcript.transcriptLink}>
                
                <div className="media-autoplay__transcript-body-inline-inner">
                    {html(compile(_transcript.inlineTranscriptBody))}
                </div>
            </div>
        );
    }

    function VideoInstructions (props) {
        return (
            <div className="media-instruction-container">
                <div className={`${_component}-instruction video-instruction`}>
                    <div className={`${_component}-instruction-inner component-instruction-inner`}></div>
                </div>
            </div>
        );
    }

    return (
        <div className="component__inner media-autoplay__inner">

            <templates.header {...props} />

            {_transcript._externalTranscript || _transcript._inlineTranscript &&
                <SkipToTranscriptButton />
            }

            <div className="component__widget media-autoplay__widget a11y-ignore-aria">

                <div className="media-options-container">

                    {_showCaptionsButton &&
                        <CaptionsButtons />
                    }

                    {_transcript._isEnabled &&
                        <TranscriptButtons />
                    }

                </div>

                {_media.mp3 || _media.ogg
                ?
                    <AudioElement media={_media} />
                :
                    <VideoElement media={_media} />
                }
                
            </div>

            {_transcript &&
                <div className="media-autoplay__transcript-container">

                    {_transcript._inlineTranscript &&
                        <InlineTranscript />
                    }

                </div>
            }

            {_videoInstruction._isEnabled &&
                <VideoInstructions />
            }

        </div>
    );
}
