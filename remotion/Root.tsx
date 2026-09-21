import React from 'react'
import { Composition } from 'remotion'
import { VIDEO_OUTPUT, videoDurationFrames, type VideoDesign } from '../shared/video-generator'
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
    headline: 'YOUR NIGHT. YOUR SOUND.',
    subline: 'DJ NightLight · allround DJ',
    dateText: '',
    locationText: '',
    logoText: 'NIGHTLIGHT',
    overlayOpacity: 0.68,
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
