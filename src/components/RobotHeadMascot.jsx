import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import "./RobotHeadMascot.css";

const RESET_POSE = {
  rotateX: 0,
  rotateY: 0,
  translateX: 0,
  translateY: 0,
  faceX: 0,
  faceY: 0,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function RobotHeadMascot({ size = 170, followMouse = true, compact = false, className = "" }) {
  const headRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();
  const [pose, setPose] = useState(RESET_POSE);

  useEffect(() => {
    if (!followMouse || shouldReduceMotion) return undefined;

    const pointerIsCoarse = window.matchMedia?.("(pointer: coarse)")?.matches;
    if (pointerIsCoarse) return undefined;

    const handleMouseMove = (event) => {
      if (!headRef.current) return;

      const rect = headRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const normalizedX = clamp((event.clientX - centerX) / (window.innerWidth / 2), -1, 1);
      const normalizedY = clamp((event.clientY - centerY) / (window.innerHeight / 2), -1, 1);

      setPose({
        rotateX: clamp(-normalizedY * 11, -11, 11),
        rotateY: clamp(normalizedX * 17, -17, 17),
        translateX: clamp(normalizedX * 7, -7, 7),
        translateY: clamp(normalizedY * 5, -5, 5),
        faceX: clamp(normalizedX * 6, -6, 6),
        faceY: clamp(normalizedY * 3, -3, 3),
      });
    };

    const handleMouseLeave = () => setPose(RESET_POSE);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [followMouse, shouldReduceMotion]);

  const idleAnimation = shouldReduceMotion
    ? {}
    : {
        y: compact ? [0, -1.5, 0] : [0, -5, 0],
        rotate: compact ? [0, 0.6, 0] : [0, 1.2, 0],
      };

  return (
    <motion.div
      ref={headRef}
      className={`robot-head-mascot ${compact ? "robot-head-mascot--compact" : ""} ${className}`}
      style={{
        width: size,
        height: size * 0.82,
        "--robot-head-rotate-x": `${pose.rotateX}deg`,
        "--robot-head-rotate-y": `${pose.rotateY}deg`,
        "--robot-head-x": `${pose.translateX}px`,
        "--robot-head-y": `${pose.translateY}px`,
        "--robot-face-x": `${pose.faceX}px`,
        "--robot-face-y": `${pose.faceY}px`,
      }}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1, ...idleAnimation }}
      whileHover={shouldReduceMotion ? undefined : { scale: compact ? 1.04 : 1.035 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
      transition={{
        opacity: { duration: 0.22 },
        scale: { duration: 0.22 },
        y: { duration: compact ? 3.2 : 3.8, repeat: Infinity, ease: "easeInOut" },
        rotate: { duration: compact ? 3.2 : 3.8, repeat: Infinity, ease: "easeInOut" },
      }}
      aria-hidden="true"
    >
      <div className="robot-head-mascot__shadow" />
      <div className="robot-head-mascot__stage">
        <div className="robot-head-mascot__ear robot-head-mascot__ear--left" />
        <div className="robot-head-mascot__ear robot-head-mascot__ear--right" />
        <div className="robot-head-mascot__head">
          <div className="robot-head-mascot__glow" />
          <div className="robot-head-mascot__face">
            <div className="robot-head-mascot__eye robot-head-mascot__eye--left" />
            <div className="robot-head-mascot__eye robot-head-mascot__eye--right" />
            <div className="robot-head-mascot__smile" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
