import { describe, expect, it } from 'vitest'
import { formatBytes, formatLatency, formatUptime, latencyTone, loadTone, pickServerAddress, sparklinePoints } from '../shared/system-status'

describe('pickServerAddress', () => {
  it('skips loopback and IPv6 and returns the first external IPv4 address', () => {
    expect(pickServerAddress({
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      eth0: [
        { address: 'fe80::1', family: 'IPv6', internal: false },
        { address: '192.168.1.20', family: 'IPv4', internal: false },
      ],
    })).toBe('192.168.1.20')
  })

  it('understands the numeric family used by older Node versions', () => {
    expect(pickServerAddress({ eth0: [{ address: '10.0.0.5', family: 4, internal: false }] })).toBe('10.0.0.5')
  })

  it('returns null when there is no external IPv4 address', () => {
    expect(pickServerAddress({ lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }], eth1: undefined })).toBeNull()
  })
})

describe('formatUptime', () => {
  it('shows the two largest units', () => {
    expect(formatUptime(45)).toBe('45 s')
    expect(formatUptime(15 * 60 + 20)).toBe('15 m')
    expect(formatUptime(2 * 3600 + 15 * 60)).toBe('2 u 15 m')
    expect(formatUptime(3 * 86_400 + 4 * 3600 + 59)).toBe('3 d 4 u')
  })

  it('falls back to a dash for missing or invalid input', () => {
    expect(formatUptime(null)).toBe('—')
    expect(formatUptime(Number.NaN)).toBe('—')
    expect(formatUptime(-1)).toBe('—')
  })
})

describe('formatBytes and formatLatency', () => {
  it('formats with a Dutch decimal comma', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1,5 KB')
    expect(formatBytes(8 * 1024 ** 3)).toBe('8,0 GB')
    expect(formatBytes(undefined)).toBe('—')
    expect(formatLatency(2.34)).toBe('2,3 ms')
    expect(formatLatency(48.6)).toBe('49 ms')
    expect(formatLatency(null)).toBe('—')
  })
})

describe('tones', () => {
  it('grades database latency stricter than the browser round trip', () => {
    expect(latencyTone(20, 'database')).toBe('ok')
    expect(latencyTone(150, 'database')).toBe('warn')
    expect(latencyTone(500, 'database')).toBe('bad')
    expect(latencyTone(150, 'roundtrip')).toBe('ok')
    expect(latencyTone(null, 'roundtrip')).toBe('bad')
  })

  it('turns meters amber at 70% and red at 90%', () => {
    expect(loadTone(69)).toBe('ok')
    expect(loadTone(70)).toBe('warn')
    expect(loadTone(90)).toBe('bad')
  })
})

describe('sparklinePoints', () => {
  it('returns nothing without samples', () => {
    expect(sparklinePoints([], 100, 40)).toBe('')
  })

  it('draws a flat line in the middle for constant values', () => {
    expect(sparklinePoints([5, 5, 5], 100, 40)).toBe('0.0,20.0 50.0,20.0 100.0,20.0')
  })

  it('puts the highest value at the top and the lowest at the bottom, inside the padding', () => {
    expect(sparklinePoints([0, 10], 100, 40, 3)).toBe('0.0,37.0 100.0,3.0')
  })
})
