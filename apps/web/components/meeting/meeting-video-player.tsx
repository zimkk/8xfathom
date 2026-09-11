'use client'

import { forwardRef, useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize2, SkipBack, SkipForward } from 'lucide-react'
import { cn, formatDuration } from '@/lib/utils'

interface MeetingVideoPlayerProps {
  src?: string | null
  initialTimeSeconds?: number
  onTimeUpdate?: (ms: number) => void
  startMs?: number
  endMs?: number
}

export const MeetingVideoPlayer = forwardRef<HTMLVideoElement, MeetingVideoPlayerProps>(
  function MeetingVideoPlayer(
    { src, initialTimeSeconds, onTimeUpdate, startMs, endMs },
    ref
  ) {
    const internalRef = useRef<HTMLVideoElement>(null)
    const videoRef = (ref as React.RefObject<HTMLVideoElement>) ?? internalRef

    const [playing, setPlaying] = useState(false)
    const [muted, setMuted] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [seeking, setSeeking] = useState(false)
    const lastUpdateRef = useRef(0)

    useEffect(() => {
      const video = videoRef.current
      if (!video) return

      if (initialTimeSeconds && !isNaN(initialTimeSeconds)) {
        video.currentTime = initialTimeSeconds
      } else if (startMs) {
        video.currentTime = startMs / 1000
      }
    }, [initialTimeSeconds, startMs])

    const handleTimeUpdate = useCallback(() => {
      const video = videoRef.current
      if (!video) return

      const now = Date.now()
      if (now - lastUpdateRef.current < 200) return
      lastUpdateRef.current = now

      const timeMs = video.currentTime * 1000
      setCurrentTime(video.currentTime)
      onTimeUpdate?.(timeMs)

      // Stop at endMs for clips
      if (endMs && video.currentTime * 1000 >= endMs) {
        video.pause()
        setPlaying(false)
      }
    }, [onTimeUpdate, endMs])

    const handleLoadedMetadata = useCallback(() => {
      const video = videoRef.current
      if (!video) return
      setDuration(video.duration)
    }, [])

    const handlePlay = useCallback(() => setPlaying(true), [])
    const handlePause = useCallback(() => setPlaying(false), [])

    const togglePlay = useCallback(() => {
      const video = videoRef.current
      if (!video) return
      if (playing) {
        video.pause()
      } else {
        // If clip and at end, reset
        if (endMs && video.currentTime * 1000 >= endMs) {
          video.currentTime = (startMs ?? 0) / 1000
        }
        video.play()
      }
    }, [playing, startMs, endMs])

    const toggleMute = useCallback(() => {
      const video = videoRef.current
      if (!video) return
      video.muted = !video.muted
      setMuted(video.muted)
    }, [])

    const handleSeekBar = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current
        if (!video) return
        const time = parseFloat(e.target.value)
        video.currentTime = time
        setCurrentTime(time)
      },
      []
    )

    const skip = useCallback(
      (secs: number) => {
        const video = videoRef.current
        if (!video) return
        video.currentTime = Math.max(
          startMs ? startMs / 1000 : 0,
          Math.min(endMs ? endMs / 1000 : video.duration, video.currentTime + secs)
        )
      },
      [startMs, endMs]
    )

    const effectiveDuration = endMs
      ? (endMs - (startMs ?? 0)) / 1000
      : duration
    const effectiveCurrent = Math.max(
      0,
      currentTime - (startMs ? startMs / 1000 : 0)
    )

    if (!src) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 text-gray-400 gap-3">
          <div className="rounded-full border border-gray-700 p-4">
            <Play className="h-8 w-8" />
          </div>
          <p className="text-sm">Demo recording</p>
          <p className="text-xs text-gray-600">Connect your calendar and record a real meeting to see video playback</p>
        </div>
      )
    }

    return (
      <div className="relative w-full h-full flex flex-col bg-black group">
        <video
          ref={videoRef}
          src={src}
          className="w-full flex-1 object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          preload="metadata"
          playsInline
        />

        {/* Controls overlay */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Seek bar */}
          <input
            type="range"
            min={startMs ? startMs / 1000 : 0}
            max={endMs ? endMs / 1000 : duration}
            value={currentTime}
            onChange={handleSeekBar}
            className="w-full h-1 mb-3 accent-primary cursor-pointer"
            style={{ accentColor: '#6366f1' }}
          />

          <div className="flex items-center gap-2">
            <button
              onClick={() => skip(-10)}
              className="text-white hover:text-primary transition-colors"
              title="Back 10s"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              onClick={togglePlay}
              className="text-white hover:text-primary transition-colors"
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>

            <button
              onClick={() => skip(10)}
              className="text-white hover:text-primary transition-colors"
              title="Forward 10s"
            >
              <SkipForward className="h-4 w-4" />
            </button>

            <span className="text-white text-xs ml-1">
              {formatDuration(effectiveCurrent * 1000)} / {formatDuration(effectiveDuration * 1000)}
            </span>

            <div className="flex-1" />

            <button
              onClick={toggleMute}
              className="text-white hover:text-primary transition-colors"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Click to play/pause */}
        <div
          className="absolute inset-0 flex items-center justify-center cursor-pointer"
          onClick={togglePlay}
          style={{ bottom: 60 }}
        >
          {!playing && (
            <div className="rounded-full bg-black/50 p-4">
              <Play className="h-8 w-8 text-white" />
            </div>
          )}
        </div>
      </div>
    )
  }
)
