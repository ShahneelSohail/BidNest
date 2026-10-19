'use client'

import { Environment, Float, OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'

const MAX_PIXEL_RATIO = 1.5

const Model = ({ model }) => {
  const { scene } = useGLTF(model.modelPath)

  return (
    <Float speed={5.5} rotationIntensity={0.5} floatIntensity={0.9}>
      <group scale={model.scale} rotation={model.rotation} position={model.position || [0, 0, 0]}>
        <primitive object={scene} />
      </group>
    </Float>
  )
}

const TechIconCardExperience = ({ model, active }) => {
  return (
    <Canvas frameloop={active ? 'always' : 'never'} dpr={[1, MAX_PIXEL_RATIO]}>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={3} />
      <spotLight position={[10, 15, 10]} angle={0.3} penumbra={1} intensity={1} />
      <Environment preset="city" />

      <Model model={model} />

      <OrbitControls enableZoom={false} />
    </Canvas>
  )
}

export default TechIconCardExperience
