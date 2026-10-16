"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { Eye, EyeOff } from "lucide-react";
import gsap from "gsap";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ─── PupilPart ─────────────────────────────────────────────────────────────────

type PupilPart =
  | "purpleLeftPupil"
  | "purpleRightPupil"
  | "blackLeftPupil"
  | "blackRightPupil"
  | "orangeLeftPupil"
  | "orangeRightPupil"
  | "yellowLeftPupil"
  | "yellowRightPupil";

type PupilNodeState = {
  node: HTMLDivElement | null;
  maxDistance: number;
  currentX: number;
  currentY: number;
  setX?: (value: number) => void;
  setY?: (value: number) => void;
};

const PUPIL_PARTS: PupilPart[] = [
  "purpleLeftPupil",
  "purpleRightPupil",
  "blackLeftPupil",
  "blackRightPupil",
  "orangeLeftPupil",
  "orangeRightPupil",
  "yellowLeftPupil",
  "yellowRightPupil",
];

// ─── Pupil ─────────────────────────────────────────────────────────────────────
// Tracking is driven by parent RAF + GSAP quickSetters via --pupil-x/--pupil-y.
// No useState, no mousemove listener, no position calculation in render.

interface PupilProps {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
  pupilPart: PupilPart;
  registerPupil: (part: PupilPart, node: HTMLDivElement | null, maxDistance: number) => void;
  forceLookX?: number;
  forceLookY?: number;
}

const Pupil = ({ size = 12, maxDistance = 5, pupilColor = "black", pupilPart, registerPupil }: PupilProps) => {
  return (
    <div
      ref={(node) => registerPupil(pupilPart, node, maxDistance)}
      data-testid={`qs-${pupilPart.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`)}`}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: "translate3d(var(--pupil-x, 0px), var(--pupil-y, 0px), 0)",
        willChange: "transform",
      }}
    />
  );
};

// ─── EyeBall ───────────────────────────────────────────────────────────────────
// Inner pupil uses --pupil-x/--pupil-y; tracking is parent-driven, no own state.

interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
  pupilPart: PupilPart;
  registerPupil: (part: PupilPart, node: HTMLDivElement | null, maxDistance: number) => void;
}

const EyeBall = ({ size = 48, pupilSize = 16, maxDistance = 10, eyeColor = "white", pupilColor = "black", isBlinking = false, pupilPart, registerPupil }: EyeBallProps) => {
  return (
    <div
      className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{ width: `${size}px`, height: isBlinking ? "2px" : `${size}px`, backgroundColor: eyeColor, overflow: "hidden" }}
    >
      {!isBlinking && (
        <div
          ref={(node) => registerPupil(pupilPart, node, maxDistance)}
          data-testid={`qs-${pupilPart.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`)}`}
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: "translate3d(var(--pupil-x, 0px), var(--pupil-y, 0px), 0)",
            willChange: "transform",
          }}
        />
      )}
    </div>
  );
};

// ─── Google icon ──────────────────────────────────────────────────────────────

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="mr-2 h-5 w-5 shrink-0" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

// ─── Main Component ───────────────────────────────────────────────────────────

interface AnimatedLoginPageProps {
  redirectUrl?: string;
}

type AnimatedPart =
  | "purpleCharacter"
  | "purpleFace"
  | "blackCharacter"
  | "blackFace"
  | "orangeCharacter"
  | "orangeFace"
  | "yellowCharacter"
  | "yellowFace"
  | "yellowMouth";

type VisualPose = "idle" | "email" | "passwordHidden" | "passwordVisible";

const CHARACTER_LAYOUT = {
  purple: { left: 70, top: 0, width: 180, height: 400, skewFactor: 1 },
  black: { left: 240, top: 90, width: 120, height: 310, skewFactor: 1.5 },
  orange: { left: 0, top: 200, width: 240, height: 200, skewFactor: 1 },
  yellow: { left: 310, top: 170, width: 140, height: 230, skewFactor: 1 },
} as const;

const TRACKED_PARTS: AnimatedPart[] = [
  "purpleCharacter",
  "purpleFace",
  "blackCharacter",
  "blackFace",
  "orangeCharacter",
  "orangeFace",
  "yellowCharacter",
  "yellowFace",
  "yellowMouth",
];

export function AnimatedLoginPage({ redirectUrl = "/dashboard" }: AnimatedLoginPageProps) {
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);

  // Animation state
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);
  const [isBlackBlinking, setIsBlackBlinking] = useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = useState(false);
  // hasMounted guards the form from SSR hydration mismatch caused by password managers.
  const [hasMounted, setHasMounted] = useState(false);
  // focusedField + hasUserInteracted: gate animation on genuine user input, not autofill
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Body/face tracking refs
  const stageRef = useRef<HTMLDivElement>(null);
  const purpleRef = useRef<HTMLDivElement | null>(null);
  const purpleFaceRef = useRef<HTMLDivElement | null>(null);
  const blackRef = useRef<HTMLDivElement | null>(null);
  const blackFaceRef = useRef<HTMLDivElement | null>(null);
  const yellowRef = useRef<HTMLDivElement | null>(null);
  const yellowFaceRef = useRef<HTMLDivElement | null>(null);
  const yellowMouthRef = useRef<HTMLDivElement | null>(null);
  const orangeRef = useRef<HTMLDivElement | null>(null);
  const orangeFaceRef = useRef<HTMLDivElement | null>(null);
  const animatedRefs = useRef<Record<AnimatedPart, HTMLDivElement | null>>({
    purpleCharacter: null,
    purpleFace: null,
    blackCharacter: null,
    blackFace: null,
    orangeCharacter: null,
    orangeFace: null,
    yellowCharacter: null,
    yellowFace: null,
    yellowMouth: null,
  });
  const mouseRef = useRef({ x: 0, y: 0 });
  const visualPoseRef = useRef<VisualPose>("idle");

  // Pupil tracking — RAF-driven via GSAP quickSetters, no React state per frame
  const pupilRefs = useRef<Record<PupilPart, PupilNodeState>>({
    purpleLeftPupil:  { node: null, maxDistance: 5, currentX: 0, currentY: 0 },
    purpleRightPupil: { node: null, maxDistance: 5, currentX: 0, currentY: 0 },
    blackLeftPupil:   { node: null, maxDistance: 4, currentX: 0, currentY: 0 },
    blackRightPupil:  { node: null, maxDistance: 4, currentX: 0, currentY: 0 },
    orangeLeftPupil:  { node: null, maxDistance: 5, currentX: 0, currentY: 0 },
    orangeRightPupil: { node: null, maxDistance: 5, currentX: 0, currentY: 0 },
    yellowLeftPupil:  { node: null, maxDistance: 5, currentX: 0, currentY: 0 },
    yellowRightPupil: { node: null, maxDistance: 5, currentX: 0, currentY: 0 },
  });
  const forcedPupilLookRef = useRef<Record<PupilPart, { x?: number; y?: number }>>({
    purpleLeftPupil: {}, purpleRightPupil: {},
    blackLeftPupil: {}, blackRightPupil: {},
    orangeLeftPupil: {}, orangeRightPupil: {},
    yellowLeftPupil: {}, yellowRightPupil: {},
  });
  // Stale-closure-safe refs for RAF — prevents isPeekingState from being captured at init value
  const isPeekingStateRef = useRef(false);
  const isPasswordVisibleRef = useRef(false);

  // Canonical 21st.dev derived conditions — no artificial intermediate states
  const hasPassword = password.length > 0;
  const isPasswordVisible = hasUserInteracted && hasPassword && showPassword;
  const isPasswordHidden = hasUserInteracted && hasPassword && !showPassword;
  // isTyping: email focus drives the "lean in" pose; password hidden handles the password case
  const isTyping = hasUserInteracted && focusedField === 'email';
  // isPeekingState: true while password is shown (drives purple crouch + eye look)
  const isPeekingState = isPasswordVisible;

  const setAnimatedRef = (part: AnimatedPart, ref: React.RefObject<HTMLDivElement | null>) => {
    return (node: HTMLDivElement | null) => {
      animatedRefs.current[part] = node;
      ref.current = node;
    };
  };

  const getAnimatedPart = (part: AnimatedPart) => animatedRefs.current[part];

  const animatePose = (nextPose: VisualPose) => {
    visualPoseRef.current = nextPose;
    const isReveal = nextPose === "passwordVisible";
    const isRaised = nextPose === "email" || nextPose === "passwordHidden";

    gsap.to(getAnimatedPart("purpleCharacter"), {
      "--pose-x": isRaised ? "40px" : "0px",
      "--pose-skew": isRaised ? "-12deg" : "0deg",
      "--pose-scale-y": isRaised ? 1.1 : 1,
      duration: 0.7,
      ease: "power2.inOut",
      overwrite: "auto",
    });
    gsap.to(getAnimatedPart("purpleFace"), {
      "--pose-x": isReveal ? "-25px" : "0px",
      "--pose-y": isReveal ? "-5px" : "0px",
      duration: 0.7,
      ease: "power2.inOut",
      overwrite: "auto",
    });
    gsap.to(getAnimatedPart("blackCharacter"), {
      "--pose-x": "0px",
      "--pose-skew": "0deg",
      duration: 0.7,
      ease: "power2.inOut",
      overwrite: "auto",
    });
    gsap.to(getAnimatedPart("blackFace"), {
      "--pose-x": isReveal ? "-16px" : "0px",
      "--pose-y": isReveal ? "-4px" : "0px",
      duration: 0.7,
      ease: "power2.inOut",
      overwrite: "auto",
    });
    gsap.to(getAnimatedPart("orangeCharacter"), {
      "--pose-skew": "0deg",
      duration: 0.7,
      ease: "power2.inOut",
      overwrite: "auto",
    });
    gsap.to(getAnimatedPart("orangeFace"), {
      "--pose-x": isReveal ? "-32px" : "0px",
      "--pose-y": isReveal ? "-5px" : "0px",
      duration: 0.2,
      ease: "power2.out",
      overwrite: "auto",
    });
    gsap.to(getAnimatedPart("yellowCharacter"), {
      "--pose-skew": "0deg",
      duration: 0.7,
      ease: "power2.inOut",
      overwrite: "auto",
    });
    gsap.to(getAnimatedPart("yellowFace"), {
      "--pose-x": isReveal ? "-32px" : "0px",
      "--pose-y": isReveal ? "-5px" : "0px",
      duration: 0.2,
      ease: "power2.out",
      overwrite: "auto",
    });
    gsap.to(getAnimatedPart("yellowMouth"), {
      "--pose-x": isReveal ? "-30px" : "0px",
      "--pose-y": "0px",
      duration: 0.2,
      ease: "power2.out",
      overwrite: "auto",
    });
  };

  // registerPupil — callback ref handler for Pupil and EyeBall inner nodes
  const registerPupil = useCallback((part: PupilPart, node: HTMLDivElement | null, maxDistance: number) => {
    const state = pupilRefs.current[part];
    if (node === null) {
      // Node unmounted (e.g., during blink) — clear refs, keep currentX/Y for remount
      state.node = null;
      state.setX = undefined;
      state.setY = undefined;
      return;
    }
    state.node = node;
    state.maxDistance = maxDistance;
    gsap.set(node, { "--pupil-x": "0px", "--pupil-y": "0px" });
    state.setX = gsap.quickSetter(node, "--pupil-x", "px") as (value: number) => void;
    state.setY = gsap.quickSetter(node, "--pupil-y", "px") as (value: number) => void;
    // Restore smoothed position immediately (avoids snap after blink remount)
    state.setX(state.currentX);
    state.setY(state.currentY);
  }, []);

  // Mount: init CSS vars + start unified RAF (body/face/pupil tracking)
  // reducedMotion only affects decorative CSS animations via the @media rule in <style>.
  // The interactive tracking RAF runs unconditionally so characters always follow the cursor.
  useEffect(() => {
    setHasMounted(true);
    mouseRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const initialVars = {
      "--pose-x": "0px",
      "--pose-y": "0px",
      "--pose-skew": "0deg",
      "--pose-scale-y": 1,
      "--mouse-x": "0px",
      "--mouse-y": "0px",
      "--mouse-skew": "0deg",
    };

    TRACKED_PARTS.forEach((part) => {
      const node = getAnimatedPart(part);
      if (node) gsap.set(node, initialVars);
    });

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", handleMouseMove);

    let frame = 0;
    const updateTracking = () => {
      const stage = stageRef.current;
      if (stage) {
        const rect = stage.getBoundingClientRect();

        // ── Body / face tracking ─────────────────────────────────────────────
        const applyTracking = (
          part: AnimatedPart,
          layout: typeof CHARACTER_LAYOUT[keyof typeof CHARACTER_LAYOUT],
        ) => {
          const centerX = rect.left + layout.left + layout.width / 2;
          const centerY = rect.top + layout.top + layout.height / 3;
          const deltaX = mouseRef.current.x - centerX;
          const deltaY = mouseRef.current.y - centerY;
          const faceX = Math.max(-15, Math.min(15, deltaX / 20));
          const faceY = Math.max(-10, Math.min(10, deltaY / 30));
          const bodySkew = Math.max(-6, Math.min(6, -deltaX / 120)) * layout.skewFactor;
          const body = getAnimatedPart(part);
          const facePart = `${part.replace("Character", "Face")}` as AnimatedPart;
          const face = getAnimatedPart(facePart);

          if (body && visualPoseRef.current !== "passwordVisible") {
            gsap.set(body, { "--mouse-skew": `${bodySkew}deg` });
          }
          // Use isPeekingStateRef to avoid stale closure capturing initial false
          if (face && !isPeekingStateRef.current) {
            gsap.set(face, { "--mouse-x": `${faceX}px`, "--mouse-y": `${faceY}px` });
          }
        };

        applyTracking("purpleCharacter", CHARACTER_LAYOUT.purple);
        applyTracking("blackCharacter", CHARACTER_LAYOUT.black);
        applyTracking("orangeCharacter", CHARACTER_LAYOUT.orange);
        applyTracking("yellowCharacter", CHARACTER_LAYOUT.yellow);

        const yellowMouth = getAnimatedPart("yellowMouth");
        const yellowFace = getAnimatedPart("yellowFace");
        if (yellowMouth && yellowFace) {
          gsap.set(yellowMouth, {
            "--mouse-x": gsap.getProperty(yellowFace, "--mouse-x"),
            "--mouse-y": gsap.getProperty(yellowFace, "--mouse-y"),
          });
        }

        // ── Pupil tracking — batch reads then batch writes (avoid layout thrash) ─
        const targets: Partial<Record<PupilPart, { tx: number; ty: number }>> = {};

        // Phase 1: all getBoundingClientRect reads
        for (const part of PUPIL_PARTS) {
          const state = pupilRefs.current[part];
          if (!state.node) continue;
          const forced = forcedPupilLookRef.current[part];
          if (forced.x !== undefined && forced.y !== undefined) {
            targets[part] = { tx: forced.x, ty: forced.y };
          } else {
            const nr = state.node.getBoundingClientRect();
            const cx = nr.left + nr.width / 2;
            const cy = nr.top + nr.height / 2;
            const dx = mouseRef.current.x - cx;
            const dy = mouseRef.current.y - cy;
            targets[part] = {
              tx: Math.max(-state.maxDistance, Math.min(state.maxDistance, dx / 15)),
              ty: Math.max(-state.maxDistance, Math.min(state.maxDistance, dy / 15)),
            };
          }
        }

        // Phase 2: all GSAP setter writes with lerp smoothing
        for (const part of PUPIL_PARTS) {
          const state = pupilRefs.current[part];
          if (!state.node || !state.setX || !state.setY) continue;
          const t = targets[part];
          if (!t) continue;
          state.currentX += (t.tx - state.currentX) * 0.35;
          state.currentY += (t.ty - state.currentY) * 0.35;
          state.setX(state.currentX);
          state.setY(state.currentY);
        }
      }
      frame = window.requestAnimationFrame(updateTracking);
    };
    frame = window.requestAnimationFrame(updateTracking);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  // Keep stale-closure refs current for RAF
  useEffect(() => {
    isPeekingStateRef.current = isPeekingState;
    isPasswordVisibleRef.current = isPasswordVisible;
  }, [isPeekingState, isPasswordVisible]);

  // Forced pupil look — priority over mouse tracking when reveal/peeking/lookAtEachOther active
  useEffect(() => {
    const forced = forcedPupilLookRef.current;
    if (isPasswordVisible) {
      forced.purpleLeftPupil  = { x: isPurplePeeking ? 4 : -4, y: isPurplePeeking ? 5 : -4 };
      forced.purpleRightPupil = { x: isPurplePeeking ? 4 : -4, y: isPurplePeeking ? 5 : -4 };
      forced.blackLeftPupil   = { x: -4, y: -4 };
      forced.blackRightPupil  = { x: -4, y: -4 };
      forced.orangeLeftPupil  = { x: -5, y: -4 };
      forced.orangeRightPupil = { x: -5, y: -4 };
      forced.yellowLeftPupil  = { x: -5, y: -4 };
      forced.yellowRightPupil = { x: -5, y: -4 };
    } else if (isLookingAtEachOther) {
      forced.purpleLeftPupil  = { x: 3, y: 4 };
      forced.purpleRightPupil = { x: 3, y: 4 };
      forced.blackLeftPupil   = { x: 0, y: -4 };
      forced.blackRightPupil  = { x: 0, y: -4 };
      // Orange/yellow follow mouse tracking during look-at-each-other
      forced.orangeLeftPupil  = {};
      forced.orangeRightPupil = {};
      forced.yellowLeftPupil  = {};
      forced.yellowRightPupil = {};
    } else {
      PUPIL_PARTS.forEach((p) => { forced[p] = {}; });
    }
  }, [isPasswordVisible, isPurplePeeking, isLookingAtEachOther]);

  useEffect(() => {
    if (!hasMounted) return;
    if (isPasswordVisible) {
      animatePose("passwordVisible");
    } else if (isPasswordHidden) {
      animatePose("passwordHidden");
    } else if (isTyping) {
      animatePose("email");
    } else {
      animatePose("idle");
    }
  }, [hasMounted, isPasswordHidden, isPasswordVisible, isTyping]);

  // Blinking — purple (verbatim from 21st.dev)
  useEffect(() => {
    const rand = () => Math.random() * 4000 + 3000;
    const schedule = (): ReturnType<typeof setTimeout> => {
      return setTimeout(() => { setIsPurpleBlinking(true); setTimeout(() => { setIsPurpleBlinking(false); schedule(); }, 150); }, rand());
    };
    const t = schedule();
    return () => clearTimeout(t);
  }, []);

  // Blinking — black (verbatim from 21st.dev)
  useEffect(() => {
    const rand = () => Math.random() * 4000 + 3000;
    const schedule = (): ReturnType<typeof setTimeout> => {
      return setTimeout(() => { setIsBlackBlinking(true); setTimeout(() => { setIsBlackBlinking(false); schedule(); }, 150); }, rand());
    };
    const t = schedule();
    return () => clearTimeout(t);
  }, []);

  // Look at each other when focusedField changes (verbatim from 21st.dev)
  useEffect(() => {
    if (focusedField !== null && hasUserInteracted) {
      setIsLookingAtEachOther(true);
      gsap.to(getAnimatedPart("purpleFace"), {
        "--pose-x": "10px",
        "--pose-y": "25px",
        duration: 0.7,
        ease: "power2.inOut",
        overwrite: "auto",
      });
      gsap.to(getAnimatedPart("blackCharacter"), {
        "--pose-x": "20px",
        "--pose-skew": "10deg",
        duration: 0.7,
        ease: "power2.inOut",
        overwrite: "auto",
      });
      gsap.to(getAnimatedPart("blackFace"), {
        "--pose-x": "6px",
        "--pose-y": "-20px",
        duration: 0.7,
        ease: "power2.inOut",
        overwrite: "auto",
      });
      const t = setTimeout(() => {
        setIsLookingAtEachOther(false);
        animatePose(visualPoseRef.current);
      }, 800);
      return () => clearTimeout(t);
    }
    setIsLookingAtEachOther(false);
  }, [focusedField, hasUserInteracted]);

  // Purple peeking — continuous loop while password is visible
  useEffect(() => {
    if (!isPasswordVisible) {
      setIsPurplePeeking(false);
      return;
    }
    let cancelled = false;
    const schedule = () => {
      setTimeout(() => {
        if (cancelled) return;
        setIsPurplePeeking(true);
        setTimeout(() => {
          if (cancelled) return;
          setIsPurplePeeking(false);
          schedule();
        }, 800);
      }, Math.random() * 3000 + 2000);
    };
    schedule();
    return () => { cancelled = true; };
  }, [isPasswordVisible]);

  // ── Auth handlers ────────────────────────────────────────────────────────────

  const resolverUrl = `/acceder/resolver?redirect_url=${encodeURIComponent(redirectUrl)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");
    setIsLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push(resolverUrl);
      } else {
        setError("Se requiere verificación adicional.");
      }
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ code: string; message: string }> };
      const code = clerkErr.errors?.[0]?.code ?? "";
      if (code === "form_password_incorrect" || code === "form_identifier_not_found") {
        setError("Correo o contraseña incorrectos. Intenta de nuevo.");
      } else if (code === "strategy_for_user_invalid") {
        setError("Este método de acceso no está disponible. Intenta con Google.");
      } else {
        setError(clerkErr.errors?.[0]?.message ?? "Error al iniciar sesión. Intenta de nuevo.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!isLoaded) return;
    setError("");
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: resolverUrl,
      });
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ message: string }> };
      setError(clerkErr.errors?.[0]?.message ?? "Error al conectar con Google.");
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");
    setIsLoading(true);
    try {
      await signIn.create({ strategy: "reset_password_email_code", identifier: forgotEmail });
      setForgotSent(true);
    } catch (err: unknown) {
      const clerkErr = err as { errors?: Array<{ message: string }> };
      setError(clerkErr.errors?.[0]?.message ?? "Error al enviar instrucciones.");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordVisibilityToggle = () => {
    const nextShowPassword = !showPassword;
    animatePose(nextShowPassword ? "passwordVisible" : "passwordHidden");
    setShowPassword(nextShowPassword);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Glow animation keyframes + reduced-motion override */}
      <style>{`
        @keyframes qs-glow-amber {
          0%   { opacity: 0.55; transform: translate3d(-3%, -2%, 0) scale(1); }
          33%  { opacity: 0.82; transform: translate3d(5%, 3%, 0) scale(1.09); }
          66%  { opacity: 0.48; transform: translate3d(1%, 7%, 0) scale(0.97); }
          100% { opacity: 0.72; transform: translate3d(-4%, 2%, 0) scale(1.13); }
        }
        @keyframes qs-glow-violet {
          0%   { opacity: 0.78; transform: translate3d(4%, 3%, 0) scale(1); }
          33%  { opacity: 1;    transform: translate3d(-5%, -4%, 0) scale(1.11); }
          66%  { opacity: 0.62; transform: translate3d(-2%, 6%, 0) scale(0.98); }
          100% { opacity: 0.88; transform: translate3d(5%, -2%, 0) scale(1.15); }
        }
        @keyframes qs-glow-pearl {
          0%   { opacity: 0.30; transform: translate3d(0, 0, 0) scale(1); }
          50%  { opacity: 0.62; transform: translate3d(-4%, -3%, 0) scale(1.11); }
          100% { opacity: 0.38; transform: translate3d(3%, 4%, 0) scale(0.93); }
        }
        @media (prefers-reduced-motion: reduce) {
          .qs-glow { animation: none !important; opacity: 0.6; }
        }
      `}</style>

      <div className="min-h-screen grid lg:grid-cols-2">
        {/* ── Left panel ── */}
        <div
          className="relative hidden lg:flex flex-col justify-between p-12"
          style={{ background: "#F2F1EF" }}
        >
          {/* Logo — wordmark oficial sobre fondo claro: sin filtro invert */}
          <div className="relative z-20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo/LOGO HORIZONTAL.svg"
              alt="QUIRICO STUDIOS"
              className="h-7 w-auto max-w-[200px]"
            />
          </div>

          {/* Characters (layout verbatim from 21st.dev) */}
          <div className="relative z-20 flex items-end justify-center h-[500px]">
            <div ref={stageRef} className="relative" style={{ width: "550px", height: "400px" }}>

              {/* Purple — outer fixed wrapper: 440px constant, no layout reflow ever */}
              <div className="absolute bottom-0" style={{ left: "70px", width: "180px", height: "440px", zIndex: 1 }}>
                {/* Purple body — GPU composited: scaleY(1.1)+translate3d+skewX, no height animation */}
                {/* willChange + backfaceVisibility: prevent artifact line from skewX+border-radius+anti-aliasing */}
                <div ref={setAnimatedRef("purpleCharacter", purpleRef)} data-testid="qs-purple-character" style={{
                  position: "absolute",
                  bottom: 0,
                  width: "180px",
                  height: "400px",
                  backgroundColor: "#6C3FF5",
                  borderRadius: "10px 10px 0 0",
                  transformOrigin: "bottom center",
                  transform: "translate3d(var(--pose-x, 0px), var(--pose-y, 0px), 0) skewX(calc(var(--mouse-skew, 0deg) + var(--pose-skew, 0deg))) scaleY(var(--pose-scale-y, 1))",
                  willChange: "transform",
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                }}>
                  {/* Purple face — base: left 45px, top 40px; movement via transform only */}
                  <div ref={setAnimatedRef("purpleFace", purpleFaceRef)} data-testid="qs-purple-face" className="absolute flex gap-8" style={{
                    left: "45px",
                    top: "40px",
                    transform: "translate3d(calc(var(--mouse-x, 0px) + var(--pose-x, 0px)), calc(var(--mouse-y, 0px) + var(--pose-y, 0px)), 0)",
                  }}>
                    <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#2D2D2D"
                      isBlinking={isPurpleBlinking}
                      pupilPart="purpleLeftPupil" registerPupil={registerPupil} />
                    <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#2D2D2D"
                      isBlinking={isPurpleBlinking}
                      pupilPart="purpleRightPupil" registerPupil={registerPupil} />
                  </div>
                </div>
              </div>

              {/* Black tall rectangle — Middle layer */}
              <div ref={setAnimatedRef("blackCharacter", blackRef)} data-testid="qs-black-character" className="absolute bottom-0" style={{
                left: "240px", width: "120px", height: "310px",
                backgroundColor: "#2D2D2D", borderRadius: "8px 8px 0 0", zIndex: 2,
                transform: "translate3d(var(--pose-x, 0px), var(--pose-y, 0px), 0) skewX(calc(var(--mouse-skew, 0deg) + var(--pose-skew, 0deg)))",
                transformOrigin: "bottom center",
              }}>
                {/* Black face — base: left 26px, top 32px; movement via transform only */}
                <div ref={setAnimatedRef("blackFace", blackFaceRef)} data-testid="qs-black-face" className="absolute flex gap-6" style={{
                  left: "26px",
                  top: "32px",
                  transform: "translate3d(calc(var(--mouse-x, 0px) + var(--pose-x, 0px)), calc(var(--mouse-y, 0px) + var(--pose-y, 0px)), 0)",
                }}>
                  <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#2D2D2D"
                    isBlinking={isBlackBlinking}
                    pupilPart="blackLeftPupil" registerPupil={registerPupil} />
                  <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#2D2D2D"
                    isBlinking={isBlackBlinking}
                    pupilPart="blackRightPupil" registerPupil={registerPupil} />
                </div>
              </div>

              {/* Orange semi-circle — Front left */}
              <div ref={setAnimatedRef("orangeCharacter", orangeRef)} data-testid="qs-orange-character" className="absolute bottom-0" style={{
                left: "0px", width: "240px", height: "200px", zIndex: 3,
                backgroundColor: "#FF9B6B", borderRadius: "120px 120px 0 0",
                transform: "skewX(calc(var(--mouse-skew, 0deg) + var(--pose-skew, 0deg)))",
                transformOrigin: "bottom center",
              }}>
                {/* Orange face — base: left 82px, top 90px; movement via transform only */}
                <div ref={setAnimatedRef("orangeFace", orangeFaceRef)} data-testid="qs-orange-face" className="absolute flex gap-8" style={{
                  left: "82px",
                  top: "90px",
                  transform: "translate3d(calc(var(--mouse-x, 0px) + var(--pose-x, 0px)), calc(var(--mouse-y, 0px) + var(--pose-y, 0px)), 0)",
                }}>
                  <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D"
                    pupilPart="orangeLeftPupil" registerPupil={registerPupil} />
                  <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D"
                    pupilPart="orangeRightPupil" registerPupil={registerPupil} />
                </div>
              </div>

              {/* Yellow rounded rectangle — Front right */}
              <div ref={setAnimatedRef("yellowCharacter", yellowRef)} data-testid="qs-yellow-character" className="absolute bottom-0" style={{
                left: "310px", width: "140px", height: "230px",
                backgroundColor: "#E8D754", borderRadius: "70px 70px 0 0", zIndex: 4,
                transform: "skewX(calc(var(--mouse-skew, 0deg) + var(--pose-skew, 0deg)))",
                transformOrigin: "bottom center",
              }}>
                {/* Yellow eyes — base: left 52px, top 40px; movement via transform only */}
                <div ref={setAnimatedRef("yellowFace", yellowFaceRef)} data-testid="qs-yellow-face" className="absolute flex gap-6" style={{
                  left: "52px",
                  top: "40px",
                  transform: "translate3d(calc(var(--mouse-x, 0px) + var(--pose-x, 0px)), calc(var(--mouse-y, 0px) + var(--pose-y, 0px)), 0)",
                }}>
                  <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D"
                    pupilPart="yellowLeftPupil" registerPupil={registerPupil} />
                  <Pupil size={12} maxDistance={5} pupilColor="#2D2D2D"
                    pupilPart="yellowRightPupil" registerPupil={registerPupil} />
                </div>
                {/* Yellow mouth — base: left 40px, top 88px; movement via transform only */}
                <div ref={setAnimatedRef("yellowMouth", yellowMouthRef)} data-testid="qs-yellow-mouth" className="absolute w-20 h-[4px] bg-[#2D2D2D] rounded-full" style={{
                  left: "40px",
                  top: "88px",
                  transform: "translate3d(calc(var(--mouse-x, 0px) + var(--pose-x, 0px)), calc(var(--mouse-y, 0px) + var(--pose-y, 0px)), 0)",
                }} />
              </div>
            </div>
          </div>

          {/* Footer — solo contacto */}
          <div className="relative z-20">
            <a
              href="mailto:hola@quiricostudios.com"
              className="text-sm transition-colors"
              style={{ color: "rgba(10,11,13,0.35)", fontFamily: "var(--font-body, 'Inter Tight', sans-serif)" }}
            >
              hola@quiricostudios.com
            </a>
          </div>

          {/* Ambient glows — sutiles sobre fondo claro */}
          <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full pointer-events-none" style={{ background: "rgba(108,63,245,0.07)", filter: "blur(70px)" }} />
          <div className="absolute bottom-1/3 left-1/4 w-80 h-80 rounded-full pointer-events-none" style={{ background: "rgba(255,155,107,0.06)", filter: "blur(90px)" }} />
        </div>

        {/* ── Right panel (Form) ── */}
        {/* relative + overflow-hidden to contain ambient glow layers */}
        <div className="relative flex flex-col min-h-screen lg:min-h-0 overflow-hidden" style={{ background: "#08090A" }}>

          {/* Ambient glow layers — centered stage for viewport-consistent composition */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <div style={{
              position: "absolute",
              top: "50%", left: "50%",
              width: "clamp(520px, 72vw, 980px)",
              height: "clamp(520px, 72vw, 980px)",
              transform: "translate(-50%, -48%)",
              pointerEvents: "none",
            }}>
              {/* Amber — upper-right of center stage */}
              <div className="qs-glow absolute" data-testid="qs-glow-amber" style={{
                top: "8%", right: "5%",
                width: "62%", paddingTop: "62%",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(255,140,0,0.22) 0%, rgba(255,140,0,0.08) 40%, transparent 70%)",
                filter: "blur(48px)",
                animation: "qs-glow-amber 11s ease-in-out infinite alternate",
                willChange: "transform, opacity",
              }} />
              {/* Violet — lower-left, brand purple #6C3FF5 */}
              <div className="qs-glow absolute" data-testid="qs-glow-violet" style={{
                bottom: "8%", left: "5%",
                width: "65%", paddingTop: "65%",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(108,63,245,0.38) 0%, rgba(108,63,245,0.14) 35%, rgba(108,63,245,0.05) 60%, transparent 72%)",
                filter: "blur(52px)",
                animation: "qs-glow-violet 14s ease-in-out 1.5s infinite alternate-reverse",
                willChange: "transform, opacity",
              }} />
              {/* Pearl — atmospheric depth */}
              <div className="qs-glow absolute" style={{
                top: "22%", left: "18%",
                width: "56%", paddingTop: "56%",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(249,249,249,0.05) 0%, rgba(249,249,249,0.02) 50%, transparent 75%)",
                filter: "blur(62px)",
                animation: "qs-glow-pearl 9s ease-in-out 3.5s infinite alternate",
                willChange: "transform, opacity",
              }} />
            </div>
          </div>

          {/* Mobile logo — fixed header above form, safe area aware, lg:hidden */}
          <div
            className="lg:hidden flex flex-col items-center justify-center shrink-0 relative z-10"
            style={{ paddingTop: "max(32px, calc(env(safe-area-inset-top, 0px) + 24px))", paddingBottom: "24px" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo/LOGO HORIZONTAL.svg"
              alt="QUIRICO STUDIOS"
              className="h-6 w-auto max-w-[172px]"
              style={{ filter: "brightness(0) invert(1)" }}
            />
            <div style={{ width: "44px", height: "1px", background: "rgba(255,140,0,0.28)", marginTop: "18px" }} />
          </div>

          {/* Form area */}
          <div className="flex flex-col items-center justify-center flex-1 lg:flex-none p-8 relative z-10 lg:min-h-screen">
            <div className="w-full max-w-[420px]">

              {mode === "login" ? (
                <>
                  <div className="text-center mb-8">
                    <h1 style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: "1.75rem", color: "#F9F9F9", letterSpacing: "-0.03em", marginBottom: "0.5rem" }}>
                      Accede a tu portal
                    </h1>
                    <p style={{ fontFamily: "var(--font-body, 'Inter Tight', sans-serif)", fontSize: "0.875rem", color: "rgba(249,249,249,0.5)" }}>
                      Gestiona tu sitio, revisa avances y responde solicitudes desde un solo lugar.
                    </p>
                  </div>

                  {/* Interactive form — deferred to client to prevent hydration mismatch from password managers */}
                  {!hasMounted ? (
                    <div className="space-y-5" style={{ minHeight: "370px" }} aria-hidden="true" />
                  ) : (
                    <>
                      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                        <div className="space-y-1.5">
                          <Label htmlFor="qs-email">Correo electrónico</Label>
                          {/* suppressHydrationWarning: browser password managers may rewrite autoComplete */}
                          <Input
                            id="qs-email"
                            type="email"
                            placeholder="tu@correo.com"
                            value={email}
                            autoComplete="email"
                            onChange={(e) => setEmail(e.target.value)}
                            onFocus={() => { setHasUserInteracted(true); setFocusedField('email'); }}
                            onBlur={() => setFocusedField(null)}
                            required
                            aria-required="true"
                            suppressHydrationWarning
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="qs-password">Contraseña</Label>
                          <div className="relative">
                            {/* suppressHydrationWarning: same reason as email input */}
                            {/* data-lpignore + data-1p-ignore: prevent LastPass/1Password injecting sibling nodes */}
                            <Input
                              id="qs-password"
                              type={showPassword ? "text" : "password"}
                              placeholder="••••••••"
                              value={password}
                              autoComplete="current-password"
                              onChange={(e) => setPassword(e.target.value)}
                              onFocus={() => { setHasUserInteracted(true); setFocusedField('password'); }}
                              onBlur={() => setFocusedField(null)}
                              required
                              aria-required="true"
                              className="pr-12"
                              data-lpignore="true"
                              data-1p-ignore=""
                              suppressHydrationWarning
                            />
                            {/* onMouseDown preventDefault: prevents focus loss from input on toggle click */}
                            <button
                              type="button"
                              onClick={handlePasswordVisibilityToggle}
                              onMouseDown={(e) => e.preventDefault()}
                              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C00]/50 rounded"
                            >
                              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => { setMode("forgot"); setError(""); }}
                            className="text-sm hover:underline underline-offset-2 transition-colors focus-visible:outline-none"
                            style={{ color: "#FF8C00", fontFamily: "var(--font-body, 'Inter Tight', sans-serif)" }}
                          >
                            Olvidé mi contraseña
                          </button>
                        </div>

                        {error && (
                          <div role="alert" className="p-3 text-sm rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontFamily: "var(--font-body, 'Inter Tight', sans-serif)" }}>
                            {error}
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isLoading || !isLoaded}
                          className={cn(
                            "w-full h-12 rounded-lg text-sm transition-all duration-200",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF8C00]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08090A]"
                          )}
                          style={{ background: "#FF8C00", color: "#0A0B0D", fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: "0.9375rem", letterSpacing: "-0.01em" }}
                        >
                          {isLoading ? "Verificando..." : "Acceder"}
                        </button>
                      </form>

                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={handleGoogle}
                          disabled={!isLoaded}
                          className={cn(
                            "w-full h-12 rounded-lg text-sm font-medium transition-all duration-200",
                            "flex items-center justify-center",
                            "border border-white/10 hover:border-white/20 hover:bg-white/5",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
                          )}
                          style={{ color: "#F9F9F9", fontFamily: "var(--font-body, 'Inter Tight', sans-serif)" }}
                        >
                          <GoogleIcon />
                          Continuar con Google
                        </button>
                      </div>

                      <p className="text-center mt-8" style={{ fontFamily: "var(--font-body, 'Inter Tight', sans-serif)", fontSize: "0.8125rem", color: "rgba(249,249,249,0.3)" }}>
                        ¿Primera vez aquí?{" "}
                        <Link href="/empezar" className="underline underline-offset-2 hover:text-white/60 transition-colors" style={{ color: "rgba(249,249,249,0.45)" }}>
                          Solicita tu acceso
                        </Link>
                      </p>
                    </>
                  )}
                </>
              ) : (
                /* Forgot password view */
                <>
                  <div className="text-center mb-8">
                    <h1 style={{ fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700, fontSize: "1.75rem", color: "#F9F9F9", letterSpacing: "-0.03em", marginBottom: "0.5rem" }}>
                      Recuperar acceso
                    </h1>
                    <p style={{ fontFamily: "var(--font-body, 'Inter Tight', sans-serif)", fontSize: "0.875rem", color: "rgba(249,249,249,0.4)" }}>
                      Te enviamos instrucciones para restablecer tu contraseña.
                    </p>
                  </div>

                  {forgotSent ? (
                    <div className="space-y-6 text-center">
                      <div className="p-4 rounded-lg" style={{ background: "rgba(255,140,0,0.07)", border: "1px solid rgba(255,140,0,0.2)" }}>
                        <p style={{ fontFamily: "var(--font-body, 'Inter Tight', sans-serif)", fontSize: "0.875rem", color: "rgba(249,249,249,0.75)" }}>
                          Si existe una cuenta con ese correo, recibirás instrucciones en breve.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setMode("login"); setForgotSent(false); setForgotEmail(""); setError(""); }}
                        className="text-sm hover:underline underline-offset-2"
                        style={{ color: "#FF8C00", fontFamily: "var(--font-body, 'Inter Tight', sans-serif)" }}
                      >
                        ← Volver al inicio de sesión
                      </button>
                    </div>
                  ) : !hasMounted ? (
                    <div className="space-y-5" style={{ minHeight: "200px" }} aria-hidden="true" />
                  ) : (
                    <form onSubmit={handleForgotSubmit} className="space-y-5" noValidate>
                      <div className="space-y-1.5">
                        <Label htmlFor="qs-forgot-email">Correo electrónico</Label>
                        <Input
                          id="qs-forgot-email"
                          type="email"
                          placeholder="tu@correo.com"
                          value={forgotEmail}
                          autoComplete="email"
                          onChange={(e) => setForgotEmail(e.target.value)}
                          required
                          aria-required="true"
                          suppressHydrationWarning
                        />
                      </div>

                      {error && (
                        <div role="alert" className="p-3 text-sm rounded-lg" style={{ color: "#ef4444", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                          {error}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isLoading || !isLoaded}
                        className="w-full h-12 rounded-lg text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: "#FF8C00", color: "#0A0B0D", fontFamily: "'Clash Grotesk', sans-serif", fontWeight: 700 }}
                      >
                        {isLoading ? "Enviando..." : "Enviar instrucciones"}
                      </button>

                      <button
                        type="button"
                        onClick={() => { setMode("login"); setError(""); }}
                        className="w-full text-sm hover:underline underline-offset-2"
                        style={{ color: "rgba(249,249,249,0.35)", fontFamily: "var(--font-body, 'Inter Tight', sans-serif)" }}
                      >
                        ← Volver
                      </button>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
