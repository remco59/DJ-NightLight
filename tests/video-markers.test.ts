import { describe, expect, it } from 'vitest'
import { MAX_PROJECT_SECONDS, createVideoProject, parseVideoProject } from '../shared/video-project'
import { addMarker, adjacentMarker, deleteMarker, snapTargets, updateMarker } from '../shared/video-timeline'

describe('timeline markers', () => {
  it('adds markers in frame order without duplicates or mutating the input', () => {
    const project = createVideoProject()
    const first = addMarker(project, 90, '  Drop  ')
    expect(project.markers).toBeUndefined()
    const second = addMarker(first.project, 30)
    expect(second.project.markers!.map(marker => [marker.frame, marker.label])).toEqual([[30, undefined], [90, 'Drop']])
    expect(second.project.markers![0]!.color).not.toBe(second.project.markers![1]!.color)
    expect(addMarker(second.project, 90).markerId).toBeNull()
    expect(addMarker(project, 1e9).project.markers![0]!.frame).toBe(30 * MAX_PROJECT_SECONDS)
  })

  it('moves, renames and deletes markers', () => {
    const { project, markerId } = addMarker(createVideoProject(), 90, 'Drop')
    const moved = updateMarker(project, markerId!, { frame: 120.4, label: '' })
    expect(moved.markers![0]).toMatchObject({ frame: 120 })
    expect(moved.markers![0]!.label).toBeUndefined()
    expect(deleteMarker(moved, markerId!).markers).toEqual([])
    expect(updateMarker(project, 'missing', { frame: 1 })).toBe(project)
  })

  it('is a snap target and supports jumping between markers', () => {
    let project = addMarker(createVideoProject(), 90).project
    project = addMarker(project, 300).project
    expect(snapTargets(project, 0)).toEqual(expect.arrayContaining([90, 300]))
    expect(adjacentMarker(project, 90, 1)).toBe(300)
    expect(adjacentMarker(project, 90, -1)).toBeNull()
    expect(adjacentMarker(project, 200, -1)).toBe(90)
  })

  it('validates with and without markers', () => {
    const project = createVideoProject()
    expect(() => parseVideoProject(project)).not.toThrow()
    const marked = addMarker(project, 60, 'Break').project
    expect(parseVideoProject(marked).markers).toHaveLength(1)
    expect(() => parseVideoProject({ ...marked, markers: [{ id: 'x', frame: 1, color: 'red' }] })).toThrow()
  })
})
