import React from 'react'
import { Composition } from 'remotion'
import {
  VIDEO_OUTPUT,
  defaultVideoGigItems,
  defaultVideoVisibility,
  videoDurationFrames,
  type VideoDesign,
} from '../shared/video-generator'
import { VerticalPost } from './VerticalPost'

export type VerticalPostProps = {
  imageSrc: string
  audioSrc?: string | null
  design: VideoDesign
}

const defaultProps: VerticalPostProps = {
  imageSrc: '',
  audioSrc: null,
  design: {
    templateKey: 'spotlight',
    motionPreset: 'smooth',
    brandPreset: 'night',
    headline: 'JOUW AVOND. JOUW SOUND.',
    subline: 'DJ NightLight · allround DJ',
    dateText: '',
    timeText: '',
    locationText: '',
    ctaText: '',
    logoText: 'NIGHTLIGHT',
    visibility: defaultVideoVisibility(),
    gigItems: defaultVideoGigItems(),
    imageX: 0,
    imageY: 0,
    zoom: 1,
    overlayOpacity: 0.72,
    textAlign: 'left',
    textPosition: 'bottom',
  },
}

export const RemotionRoot: React.FC = () => (
  <Composition
    id="NightLightVertical"
    component={VerticalPost}
    durationInFrames={videoDurationFrames()}
    fps={VIDEO_OUTPUT.fps}
    width={VIDEO_OUTPUT.width}
    height={VIDEO_OUTPUT.height}
    defaultProps={defaultProps}
  />
)
