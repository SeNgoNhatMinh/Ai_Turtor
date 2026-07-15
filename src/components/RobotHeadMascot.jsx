import { useEffect, useRef, useState } from "react";
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

export default function RobotHeadMascot({
  size = 170,
  followMouse = true,
  compact = false,
  talking = false,
  ariaLabel,
  className = "",
}) {
  const headRef = useRef(null);
  const rafRef = useRef(0);
  const nextPoseRef = useRef(RESET_POSE);
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false);

  const applyPose = (nextPose) => {
    const node = headRef.current;
    if (!node) return;
    node.style.setProperty("--robot-head-rotate-x", `${nextPose.rotateX}deg`);
    node.style.setProperty("--robot-head-rotate-y", `${nextPose.rotateY}deg`);
    node.style.setProperty("--robot-head-x", `${nextPose.translateX}px`);
    node.style.setProperty("--robot-head-y", `${nextPose.translateY}px`);
    node.style.setProperty("--robot-face-x", `${nextPose.faceX}px`);
    node.style.setProperty("--robot-face-y", `${nextPose.faceY}px`);
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mediaQuery) return undefined;

    const handleChange = () => setShouldReduceMotion(mediaQuery.matches);
    handleChange();
    mediaQuery.addEventListener?.("change", handleChange);
    return () => mediaQuery.removeEventListener?.("change", handleChange);
  }, []);

  useEffect(() => {
    if (!followMouse || shouldReduceMotion) return undefined;

    const pointerIsCoarse = window.matchMedia?.("(pointer: coarse)")?.matches;
    if (pointerIsCoarse) return undefined;

    const schedulePose = (nextPose) => {
      nextPoseRef.current = nextPose;
      if (rafRef.current) return;
      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = 0;
        applyPose(nextPoseRef.current);
      });
    };

    const handleMouseMove = (event) => {
      if (!headRef.current) return;

      const rect = headRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const normalizedX = clamp((event.clientX - centerX) / (window.innerWidth / 2), -1, 1);
      const normalizedY = clamp((event.clientY - centerY) / (window.innerHeight / 2), -1, 1);

      schedulePose({
        rotateX: clamp(-normalizedY * 11, -11, 11),
        rotateY: clamp(normalizedX * 17, -17, 17),
        translateX: clamp(normalizedX * 7, -7, 7),
        translateY: clamp(normalizedY * 5, -5, 5),
        faceX: clamp(normalizedX * 6, -6, 6),
        faceY: clamp(normalizedY * 3, -3, 3),
      });
    };

    const handleMouseLeave = () => schedulePose(RESET_POSE);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [followMouse, shouldReduceMotion]);

  return (
    <div
      ref={headRef}
      className={`robot-head-mascot ${compact ? "robot-head-mascot--compact" : ""} ${!shouldReduceMotion ? "robot-head-mascot--idle" : ""} ${talking ? "robot-head-mascot--talking" : ""} ${className}`}
      style={{
        width: size,
        height: size * 0.82,
        "--robot-head-rotate-x": "0deg",
        "--robot-head-rotate-y": "0deg",
        "--robot-head-x": "0px",
        "--robot-head-y": "0px",
        "--robot-face-x": "0px",
        "--robot-face-y": "0px",
      }}
      aria-hidden={ariaLabel ? undefined : "true"}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
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
    </div>
  );
}
