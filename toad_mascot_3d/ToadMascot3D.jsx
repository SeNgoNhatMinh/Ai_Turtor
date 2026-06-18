import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function S({ material, position, scale, name }) {
  return (
    <mesh name={name} position={position} scale={scale} castShadow receiveShadow>
      <sphereGeometry args={[1, 48, 24]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function C({ material, position, scale, rotation, name }) {
  return (
    <mesh name={name} position={position} scale={scale} rotation={rotation} castShadow receiveShadow>
      <capsuleGeometry args={[0.5, 1.0, 10, 24]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

function ToadModel() {
  const group = useRef();
  const leftPupil = useRef();
  const rightPupil = useRef();
  const leftEye = useRef();
  const rightEye = useRef();
  const smooth = useMemo(() => new THREE.Vector2(0, 0), []);

  const mat = useMemo(() => ({
    orange: new THREE.MeshStandardMaterial({ color: 0xffa51f, roughness: 0.58 }),
    orangeDark: new THREE.MeshStandardMaterial({ color: 0xf88a12, roughness: 0.62 }),
    belly: new THREE.MeshStandardMaterial({ color: 0xf6ef93, roughness: 0.65 }),
    white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38 }),
    black: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }),
    green: new THREE.MeshStandardMaterial({ color: 0x2fa145, roughness: 0.75 }),
    greenLight: new THREE.MeshStandardMaterial({ color: 0x77bf55, roughness: 0.75 })
  }), []);

  useFrame(({ mouse, clock }) => {
    const t = clock.getElapsedTime();
    smooth.lerp(mouse, 0.075);

    group.current.rotation.y = smooth.x * 0.38;
    group.current.rotation.x = -smooth.y * 0.13 + Math.sin(t * 1.2) * 0.018;
    group.current.rotation.z = -smooth.x * 0.035;
    group.current.position.y = 0.08 + Math.sin(t * 1.6) * 0.045;

    leftPupil.current.position.x = 0.08 + smooth.x * 0.07;
    leftPupil.current.position.y = -0.08 - smooth.y * 0.055;
    rightPupil.current.position.x = -0.08 + smooth.x * 0.07;
    rightPupil.current.position.y = -0.08 - smooth.y * 0.055;

    const phase = t % 4.2;
    const blink = phase > 3.92 ? Math.sin(((phase - 3.92) / 0.28) * Math.PI) : 0;
    leftEye.current.scale.y = 1 - blink * 0.78;
    rightEye.current.scale.y = 1 - blink * 0.78;
  });

  return (
    <group ref={group} position={[0, 0.08, 0]}>
      <S name="lily-pad" material={mat.green} position={[0, -1.48, -0.05]} scale={[2.05, 0.13, 0.82]} />
      <S material={mat.greenLight} position={[-0.25, -1.37, 0.28]} scale={[1.32, 0.035, 0.32]} />

      <S name="body" material={mat.orange} position={[0, -0.28, 0]} scale={[1.38, 1.22, 0.72]} />
      <S name="belly" material={mat.belly} position={[0, -0.72, 0.67]} scale={[0.98, 0.56, 0.12]} />

      {[[-0.98, -0.25], [-1.12, -0.55], [-0.88, -0.75], [0.98, -0.25], [1.12, -0.55], [0.88, -0.75]].map(([x, y], i) => (
        <S key={i} material={mat.belly} position={[x, y, 0.69]} scale={[i % 3 === 0 ? 0.14 : 0.1, i % 3 === 0 ? 0.14 : 0.1, 0.025]} />
      ))}

      <group position={[-0.48, 0.52, 0.62]}>
        <mesh ref={leftEye} castShadow receiveShadow>
          <sphereGeometry args={[1, 48, 24]} />
          <meshStandardMaterial color="white" roughness={0.38} />
        </mesh>
        <S material={mat.orangeDark} position={[0, 0.24, 0.15]} scale={[0.39, 0.24, 0.05]} />
        <mesh ref={leftPupil} position={[0.08, -0.08, 0.13]} scale={[0.095, 0.15, 0.028]}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </group>

      <group position={[0.48, 0.52, 0.62]}>
        <mesh ref={rightEye} castShadow receiveShadow>
          <sphereGeometry args={[1, 48, 24]} />
          <meshStandardMaterial color="white" roughness={0.38} />
        </mesh>
        <S material={mat.orangeDark} position={[0, 0.24, 0.15]} scale={[0.39, 0.24, 0.05]} />
        <mesh ref={rightPupil} position={[-0.08, -0.08, 0.13]} scale={[0.095, 0.15, 0.028]}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      </group>

      <C name="left-arm" material={mat.orange} position={[-1.28, -0.75, 0.25]} scale={[0.25, 0.7, 0.23]} rotation={[0, 0, -0.72]} />
      <C name="right-arm" material={mat.orange} position={[1.28, -0.75, 0.25]} scale={[0.25, 0.7, 0.23]} rotation={[0, 0, 0.72]} />
      <C name="left-leg" material={mat.orange} position={[-0.85, -1.15, 0.55]} scale={[0.22, 0.55, 0.18]} rotation={[0, 0, -1.18]} />
      <C name="right-leg" material={mat.orange} position={[0.85, -1.15, 0.55]} scale={[0.22, 0.55, 0.18]} rotation={[0, 0, 1.18]} />
    </group>
  );
}

export default function ToadMascot3D() {
  return (
    <div style={{ width: '100%', height: '100vh', background: 'linear-gradient(#bfefff, #67c7e8)' }}>
      <Canvas camera={{ position: [0, 0.25, 7.4], fov: 38 }} shadows>
        <ambientLight intensity={1.8} />
        <directionalLight position={[4, 6, 6]} intensity={2.7} castShadow />
        <directionalLight position={[-4, 3, -5]} intensity={1.2} color="#9be7ff" />
        <ToadModel />
      </Canvas>
    </div>
  );
}
