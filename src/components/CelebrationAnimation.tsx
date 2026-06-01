import React, { useEffect, useState } from 'react';

interface CelebrationAnimationProps {
  isVisible: boolean;
  onComplete: () => void;
}

interface Particle {
  id: number;
  shape: 'square' | 'circle' | 'bar';
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  scale: number;
  opacity: number;
  color: string;
}

const CelebrationAnimation: React.FC<CelebrationAnimationProps> = ({
  isVisible,
  onComplete
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!isVisible) return;

    const confettiColors = ['#111111', '#6f6f67', '#d86242', '#2f6f5f', '#3e73b8', '#7d5ac7', '#dfb84f'];

    const newParticles: Particle[] = [];
    for (let i = 0; i < 76; i++) {
      const isFromLeft = Math.random() < 0.5;
      newParticles.push({
        id: Date.now() + i,
        shape: i % 5 === 0 ? 'circle' : i % 3 === 0 ? 'bar' : 'square',
        x: isFromLeft ? -50 : window.innerWidth + 50,
        y: Math.random() * window.innerHeight * 0.6 + window.innerHeight * 0.2,
        vx: (isFromLeft ? 1 : -1) * (Math.random() * 4 + 3),
        vy: (Math.random() - 0.5) * 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 16,
        scale: Math.random() * 0.8 + 0.6,
        opacity: 1,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)]
      });
    }

    setParticles(newParticles);

    // 动画循环
    let animationId: number;
    const animate = () => {
      setParticles(prev => prev.map(particle => ({
        ...particle,
        x: particle.x + particle.vx,
        y: particle.y + particle.vy,
        rotation: particle.rotation + particle.rotationSpeed,
        opacity: Math.max(0, particle.opacity - 0.016),
        vy: particle.vy + 0.08
      })).filter(particle => 
        particle.x > -100 && 
        particle.x < window.innerWidth + 100 && 
        particle.y < window.innerHeight + 100 &&
        particle.opacity > 0
      ));

      animationId = requestAnimationFrame(animate);
    };

    animate();

    // 1.5秒后清理动画
    const timer = setTimeout(() => {
      setParticles([]);
      onComplete();
    }, 1700);

    return () => {
      cancelAnimationFrame(animationId);
      clearTimeout(timer);
    };
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute select-none shadow-[0_0_18px_rgba(255,255,255,0.42)]"
          style={{
            left: `${particle.x}px`,
            top: `${particle.y}px`,
            width: particle.shape === 'bar' ? '5px' : '10px',
            height: particle.shape === 'bar' ? '24px' : '10px',
            borderRadius: particle.shape === 'circle' ? '999px' : '2px',
            backgroundColor: particle.color,
            transform: `rotate(${particle.rotation}deg) scale(${particle.scale})`,
            opacity: particle.opacity,
          }}
        />
      ))}

      {/* 中央庆祝文字 */}
      <div 
        className="completion-modal settings-shell absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[22px] px-8 py-6 text-center"
      >
        <div className="text-3xl font-black text-[rgb(var(--accent-rgb))]">
          完成
        </div>
        <div className="mt-2 text-sm text-[var(--muted)]">
          这个颜色拼完了！
        </div>
      </div>
    </div>
  );
};

export default CelebrationAnimation;
