import { useEffect } from 'react';
import { MotionDiv, useAnimationControls } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';

export default function AtlasPresence() {
  const { mode, presenceActive, dissolving, visualization } = useAtlasStore();
  const primaryColor = visualization.colorPrimary || '#5CC8FF';
  const controls = useAnimationControls();

  useEffect(() => {
    if (mode !== 'idle' || dissolving) {
      controls.start({ 
        opacity: 0, 
        filter: 'blur(24px)', 
        scale: 0.95,
        transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
      });
    } else {
      controls.start({ 
        opacity: 1, 
        filter: 'blur(0px)', 
        scale: 1,
        transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1] }
      });
    }
  }, [mode, dissolving, controls]);

  return (
    <MotionDiv
      animate={controls}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      data-testid="atlas-presence"
    >
      <MotionDiv
        className="absolute w-[1200px] h-[600px] rounded-full"
        style={{
          top: '10%',
          right: '10%',
          background: 'radial-gradient(ellipse at center, rgba(85,165,255,0.15) 0%, transparent 70%)',
        }}
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.15, 0.2, 0.15],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      
      <MotionDiv
        className="absolute w-[800px] h-[400px] rounded-full"
        style={{
          bottom: '15%',
          left: '5%',
          background: 'radial-gradient(ellipse at center, rgba(255,140,85,0.12) 0%, transparent 70%)',
        }}
        animate={{
          scale: [1, 1.08, 1],
          opacity: [0.12, 0.18, 0.12],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
      />

      <MotionDiv
        className="absolute w-[600px] h-[600px] rounded-full"
        style={{
          top: '40%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(circle at center, rgba(140,85,255,0.08) 0%, transparent 60%)',
        }}
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 5, 0],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
      />

      {presenceActive && (
        <MotionDiv
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
        >
          <MotionDiv
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: `${primaryColor}99` }}
            animate={{
              boxShadow: [
                `0 0 20px 8px ${primaryColor}4D`,
                `0 0 40px 16px ${primaryColor}33`,
                `0 0 20px 8px ${primaryColor}4D`,
              ],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        </MotionDiv>
      )}
    </MotionDiv>
  );
}
