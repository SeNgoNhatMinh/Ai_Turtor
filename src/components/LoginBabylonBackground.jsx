import React, { useEffect, useRef } from 'react';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { Engine } from '@babylonjs/core/Engines/engine';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

function LoginBabylonBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: false,
      stencil: false,
      antialias: true,
    });

    const scene = new Scene(engine);
    scene.clearColor = new Color4(1, 0.97, 0.93, 0);

    const camera = new ArcRotateCamera('login-camera', -Math.PI / 2.35, Math.PI / 2.4, 9, Vector3.Zero(), scene);
    camera.attachControl(canvas, false);
    camera.inputs.clear();

    new HemisphericLight('login-hemi-light', new Vector3(0, 1, 0), scene).intensity = 0.85;
    const keyLight = new DirectionalLight('login-key-light', new Vector3(-0.35, -0.7, -0.45), scene);
    keyLight.position = new Vector3(4, 5, 4);
    keyLight.intensity = 1.1;

    const orange = new StandardMaterial('login-orange', scene);
    orange.diffuseColor = Color3.FromHexString('#F37021');
    orange.emissiveColor = Color3.FromHexString('#7A2C08');
    orange.specularColor = Color3.FromHexString('#FFD2B3');

    const cream = new StandardMaterial('login-cream', scene);
    cream.diffuseColor = Color3.FromHexString('#FFFFFF');
    cream.emissiveColor = Color3.FromHexString('#3D2416');
    cream.specularColor = Color3.FromHexString('#FFE6D6');

    const teal = new StandardMaterial('login-teal', scene);
    teal.diffuseColor = Color3.FromHexString('#1D7E83');
    teal.emissiveColor = Color3.FromHexString('#0A3335');
    teal.specularColor = Color3.FromHexString('#BDECEF');

    const navy = new StandardMaterial('login-navy', scene);
    navy.diffuseColor = Color3.FromHexString('#163A5F');
    navy.emissiveColor = Color3.FromHexString('#071827');
    navy.specularColor = Color3.FromHexString('#8AB8D8');

    const paper = new StandardMaterial('login-paper', scene);
    paper.diffuseColor = Color3.FromHexString('#FFFDF8');
    paper.emissiveColor = Color3.FromHexString('#3A2A1E');
    paper.specularColor = Color3.FromHexString('#FFFFFF');

    const yellow = new StandardMaterial('login-yellow', scene);
    yellow.diffuseColor = Color3.FromHexString('#F8C94B');
    yellow.emissiveColor = Color3.FromHexString('#5C3E00');
    yellow.specularColor = Color3.FromHexString('#FFF1A8');

    const green = new StandardMaterial('login-green', scene);
    green.diffuseColor = Color3.FromHexString('#2E8B57');
    green.emissiveColor = Color3.FromHexString('#0E3521');
    green.specularColor = Color3.FromHexString('#B8F0CF');

    const glow = new GlowLayer('login-glow', scene);
    glow.intensity = 0.22;

    const createObject = (name, position, rotation, speed) => {
      const node = new TransformNode(name, scene);
      node.position = new Vector3(...position);
      node.rotation = new Vector3(...rotation);
      return { node, speed, baseY: position[1] };
    };

    const setParent = (mesh, node, material, position = [0, 0, 0], rotation = [0, 0, 0]) => {
      mesh.parent = node;
      mesh.material = material;
      mesh.position = new Vector3(...position);
      mesh.rotation = new Vector3(...rotation);
      return mesh;
    };

    const book = createObject('study-book', [-3.65, 1.15, 0.05], [0.28, -0.36, -0.16], 0.0018);
    setParent(MeshBuilder.CreateBox('book-pages', { width: 1.45, height: 0.16, depth: 0.95 }, scene), book.node, paper);
    setParent(MeshBuilder.CreateBox('book-cover-top', { width: 1.54, height: 0.05, depth: 1.03 }, scene), book.node, teal, [0, 0.13, 0]);
    setParent(MeshBuilder.CreateBox('book-cover-bottom', { width: 1.54, height: 0.05, depth: 1.03 }, scene), book.node, teal, [0, -0.13, 0]);
    setParent(MeshBuilder.CreateBox('book-spine', { width: 0.12, height: 0.34, depth: 1.08 }, scene), book.node, orange, [-0.82, 0, 0]);

    const pencil = createObject('study-pencil', [3.85, 1.45, -0.15], [0.18, 0.25, -0.72], -0.0022);
    setParent(MeshBuilder.CreateCylinder('pencil-body', { diameter: 0.16, height: 1.45, tessellation: 24 }, scene), pencil.node, yellow, [0, 0, 0], [0, 0, Math.PI / 2]);
    setParent(MeshBuilder.CreateCylinder('pencil-tip', { diameterTop: 0, diameterBottom: 0.17, height: 0.28, tessellation: 24 }, scene), pencil.node, orange, [0.86, 0, 0], [0, 0, -Math.PI / 2]);
    setParent(MeshBuilder.CreateCylinder('pencil-eraser', { diameter: 0.17, height: 0.22, tessellation: 24 }, scene), pencil.node, cream, [-0.84, 0, 0], [0, 0, Math.PI / 2]);

    const board = createObject('study-board', [3.45, -1.25, 0.15], [-0.2, -0.28, 0.14], 0.0015);
    setParent(MeshBuilder.CreateBox('board-surface', { width: 1.75, height: 1.05, depth: 0.08 }, scene), board.node, green);
    setParent(MeshBuilder.CreateBox('board-frame-top', { width: 1.92, height: 0.08, depth: 0.12 }, scene), board.node, orange, [0, 0.58, 0]);
    setParent(MeshBuilder.CreateBox('board-frame-bottom', { width: 1.92, height: 0.08, depth: 0.12 }, scene), board.node, orange, [0, -0.58, 0]);
    setParent(MeshBuilder.CreateBox('board-frame-left', { width: 0.08, height: 1.16, depth: 0.12 }, scene), board.node, orange, [-0.96, 0, 0]);
    setParent(MeshBuilder.CreateBox('board-frame-right', { width: 0.08, height: 1.16, depth: 0.12 }, scene), board.node, orange, [0.96, 0, 0]);

    const cap = createObject('graduation-cap', [-1.1, -1.85, 0.2], [0.18, 0.46, 0.1], -0.0017);
    setParent(MeshBuilder.CreateBox('cap-top', { width: 1.35, height: 0.08, depth: 1.35 }, scene), cap.node, navy, [0, 0.12, 0]);
    setParent(MeshBuilder.CreateBox('cap-band', { width: 0.68, height: 0.3, depth: 0.68 }, scene), cap.node, navy, [0, -0.08, 0]);
    setParent(MeshBuilder.CreateSphere('cap-button', { diameter: 0.14, segments: 20 }, scene), cap.node, orange, [0, 0.2, 0]);
    setParent(MeshBuilder.CreateCylinder('cap-tassel', { diameter: 0.045, height: 0.85, tessellation: 12 }, scene), cap.node, orange, [0.52, -0.1, 0.15], [0.35, 0, 0.08]);

    const ruler = createObject('study-ruler', [-4.15, -0.9, -0.18], [-0.18, -0.25, 0.64], 0.0024);
    setParent(MeshBuilder.CreateBox('ruler-body', { width: 1.75, height: 0.18, depth: 0.08 }, scene), ruler.node, cream);
    [-0.65, -0.32, 0, 0.32, 0.65].forEach((x, index) => {
      setParent(MeshBuilder.CreateBox(`ruler-mark-${index}`, { width: 0.035, height: 0.2, depth: 0.09 }, scene), ruler.node, orange, [x, 0.02, 0.02]);
    });

    const learningObjects = [book, pencil, board, cap, ruler];

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;

    scene.onBeforeRenderObservable.add(() => {
      frame += 1;
      learningObjects.forEach(({ node, speed, baseY }, index) => {
        node.rotation.y += speed * engine.getDeltaTime();
        node.rotation.z += speed * engine.getDeltaTime() * 0.35;
        node.position.y = baseY + Math.sin((frame + index * 42) * 0.018) * 0.045;
      });
    });

    engine.runRenderLoop(() => {
      scene.render();
      if (reducedMotion) {
        engine.stopRenderLoop();
      }
    });

    const handleResize = () => engine.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      scene.dispose();
      engine.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className="login-babylon-canvas" aria-hidden="true" />;
}

export default LoginBabylonBackground;
