import { motion, type MotionProps, AnimatePresence, useAnimationControls } from 'framer-motion';
import type { HTMLAttributes, ButtonHTMLAttributes, VideoHTMLAttributes, RefAttributes } from 'react';

type MotionDivProps = MotionProps & HTMLAttributes<HTMLDivElement> & RefAttributes<HTMLDivElement>;
type MotionSpanProps = MotionProps & HTMLAttributes<HTMLSpanElement> & RefAttributes<HTMLSpanElement>;
type MotionButtonProps = MotionProps & ButtonHTMLAttributes<HTMLButtonElement> & RefAttributes<HTMLButtonElement>;
type MotionVideoProps = MotionProps & VideoHTMLAttributes<HTMLVideoElement> & RefAttributes<HTMLVideoElement>;

export const MotionDiv = motion.div as React.FC<MotionDivProps>;
export const MotionSpan = motion.span as React.FC<MotionSpanProps>;
export const MotionButton = motion.button as React.FC<MotionButtonProps>;
export const MotionVideo = motion.video as React.FC<MotionVideoProps>;

export { AnimatePresence, useAnimationControls };
export type { MotionProps };
