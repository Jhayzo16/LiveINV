import { useEffect, useMemo, useRef } from 'react'
import { PanResponder, type GestureResponderEvent } from 'react-native'
import { touchDelta, withinTapSlop, type Point, type TouchSample } from '../map-gestures'

export function useMapTouch({ onPan, onPinch, onInteractionChange, onTap }: {
  onPan: (x: number, y: number) => void
  onPinch: (scale: number, from: Point, to: Point) => void
  onInteractionChange: (active: boolean) => void
  onTap?: (point: Point) => void
}) {
  const previous = useRef<TouchSample[]>([])
  const moved = useRef(false)
  const tapStart = useRef<Point | null>(null)
  useEffect(() => () => onInteractionChange(false), [onInteractionChange])
  return useMemo(() => {
    const sample = (event: GestureResponderEvent) => event.nativeEvent.touches.map(t => ({ id: t.identifier, x: t.pageX, y: t.pageY }))
    const finish = () => { previous.current = []; onInteractionChange(false) }
    // PanResponder stores callbacks; these refs are only accessed on touch events.
    // eslint-disable-next-line react-hooks/refs
    const responder = PanResponder.create({
      // Claim empty map space immediately, before the outer ScrollView can
      // intercept a vertical drag. Room/floor buttons still win on a tap.
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: event => Boolean(onTap) || event.nativeEvent.touches.length > 1,
      onMoveShouldSetPanResponder: (_, gesture) => Math.hypot(gesture.dx, gesture.dy) > 4,
      onMoveShouldSetPanResponderCapture: (_, gesture) => gesture.numberActiveTouches > 1 || Math.hypot(gesture.dx, gesture.dy) > 4,
      onPanResponderGrant: (event, gesture) => {
        previous.current = sample(event)
        tapStart.current = previous.current[0] ?? null
        moved.current = previous.current.length > 1 || Math.hypot(gesture.dx, gesture.dy) > 8
        onInteractionChange(true)
      },
      onPanResponderStart: event => {
        previous.current = sample(event)
        if (previous.current.length > 1) moved.current = true
      },
      onPanResponderMove: event => {
        const next = sample(event)
        if (!moved.current && next.length === 1 && tapStart.current && withinTapSlop(tapStart.current, next[0])) return
        moved.current = true
        const delta = touchDelta(previous.current, next)
        previous.current = next
        if (delta?.kind === 'pan') onPan(delta.x, delta.y)
        if (delta?.kind === 'pinch') onPinch(delta.scale, delta.from, delta.to)
      },
      onPanResponderEnd: event => { previous.current = sample(event) },
      onPanResponderRelease: event => {
        const point = event.nativeEvent.changedTouches[0] ?? event.nativeEvent
        const end = { x: point.pageX, y: point.pageY }
        if (!moved.current && tapStart.current && withinTapSlop(tapStart.current, end)) onTap?.(end)
        finish()
      },
      onPanResponderTerminate: () => { moved.current = true; finish() },
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
    })
    return {
      handlers: {
        ...responder.panHandlers,
        onTouchStart: (event: GestureResponderEvent) => {
          if (event.nativeEvent.touches.length > 1) moved.current = true
          onInteractionChange(true)
        },
        onTouchEnd: (event: GestureResponderEvent) => { if (!event.nativeEvent.touches.length) finish() },
        onTouchCancel: () => { moved.current = true; finish() },
      },
      isTap: () => !moved.current,
    }
  }, [onPan, onPinch, onInteractionChange, onTap])
}
