import React from 'react'
import { Composition } from 'remotion'
import {
  VIDEO_OUTPUT,
  defaultVideoGigItems,
  defaultVideoVisibility,
  videoDurationFrames,
  type VideoDesign,
} from '../shared/video-generator'
import { createVideoProject, projectDurationFrames } from '../shared/video-project'
import { PROJECT_COMPOSITION_ID, ProjectComposition, type ProjectCompositionProps } from './ProjectComposition'
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

const defaultProjectProps: ProjectCompositionProps = {
  project: createVideoProject('9:16'),
  assets: {},
}

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id={PROJECT_COMPOSITION_ID}
      component={ProjectComposition}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={300}
      defaultProps={defaultProjectProps}
      calculateMetadata={({ props }) => ({
        width: props.project.width,
        height: props.project.height,
        fps: props.project.fps,
        durationInFrames: projectDurationFrames(props.project),
      })}
    />
    {/* Legacy single-image renders queued before the timeline editor existed. */}
    <Composition
      id="NightLightVertical"
      component={VerticalPost}
      durationInFrames={videoDurationFrames()}
      fps={VIDEO_OUTPUT.fps}
      width={VIDEO_OUTPUT.width}
      height={VIDEO_OUTPUT.height}
      defaultProps={defaultProps}
    />
  </>
)
