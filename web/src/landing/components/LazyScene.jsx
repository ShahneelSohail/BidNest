'use client'

import { Suspense, useEffect, useRef, useState } from 'react'

const PRELOAD_MARGIN = '700px'

// Loads a 3D scene's code and assets only when it is about to be seen, and
// pauses its render loop whenever it is off screen.
const LazyScene = ({ load, ...sceneProps }) => {
  const containerRef = useRef(null)
  const requested = useRef(false)
  const [Scene, setScene] = useState(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setActive(entry.isIntersecting)
        if (entry.isIntersecting && !requested.current) {
          requested.current = true
          load().then(module => setScene(() => module.default))
        }
      },
      { rootMargin: PRELOAD_MARGIN }
    )
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [load])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {Scene && (
        <Suspense fallback={null}>
          <Scene active={active} {...sceneProps} />
        </Suspense>
      )}
    </div>
  )
}

export default LazyScene
