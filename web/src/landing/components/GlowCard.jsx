'use client'

import { useRef, useEffect } from "react";

const GlowCard = ({ card, index, children }) => {
  const cardRefs = useRef([]);
  const targetRotate = useRef({ x: 0, y: 0 }); // target rotation
  const currentRotate = useRef({ x: 0, y: 0 }); // smoothed rotation
  const animationFrame = useRef(null);

  // linear interpolation helper
  const lerp = (start, end, factor) => start + (end - start) * factor;

  const updateAnimation = (card) => {
    if (!card) return;

    currentRotate.current.x = lerp(
      currentRotate.current.x,
      targetRotate.current.x,
      0.1
    );
    currentRotate.current.y = lerp(
      currentRotate.current.y,
      targetRotate.current.y,
      0.1
    );

    card.style.transform = `perspective(1000px) rotateX(${currentRotate.current.x}deg) rotateY(${currentRotate.current.y}deg)`;

    animationFrame.current = requestAnimationFrame(() => updateAnimation(card));
  };

  const handleMouseMove = (index) => (e) => {
    const card = cardRefs.current[index];
    if (!card) return;

    const rect = card.getBoundingClientRect();

    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    // 🌟 Glow angle
    let angle = Math.atan2(mouseY, mouseX) * (180 / Math.PI);
    angle = (angle + 360) % 360;
    card.style.setProperty("--start", angle + 60);

    // 🎯 Concave inward tilt target
    const rotateX = -(mouseY / (rect.height / 2)) * 10;
    const rotateY = (mouseX / (rect.width / 2)) * 10;

    targetRotate.current.x = Math.max(Math.min(rotateX, 10), -10);
    targetRotate.current.y = Math.max(Math.min(rotateY, 10), -10);

    if (!animationFrame.current) {
      animationFrame.current = requestAnimationFrame(() => updateAnimation(card));
    }
  };

  const handleMouseLeave = (index) => () => {
    const card = cardRefs.current[index];
    if (!card) return;

    // reset target
    targetRotate.current = { x: 0, y: 0 };
  };

  useEffect(() => {
    return () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
    };
  }, []);

  return (
    <div
      ref={(el) => (cardRefs.current[index] = el)}
      onMouseMove={handleMouseMove(index)}
      onMouseLeave={handleMouseLeave(index)}
      className="card card-border timeline-card rounded-xl p-10 mb-5 break-inside-avoid-column will-change-transform"
    >
      <div className="glow"></div>
      <div className="flex items-center gap-1 mb-5">
        {Array.from({ length: 5 }, (_, i) => (
          <img key={i} src="/images/star.png" alt="star" className="size-5" />
        ))}
      </div>
      <div className="mb-5">
        <p className="text-white-50 text-lg">{card.review}</p>
      </div>
      {children}
    </div>
  );
};

export default GlowCard;
