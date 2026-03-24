/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, animate } from 'motion/react';

type Difficulty = 'Easy' | 'Normal' | 'Pro' | 'Hell';
type GameState = 'start' | 'playing' | 'result';
type PlayPhase = 'animating_question' | 'input' | 'show_result';

type RoundData = {
  target: number;
  input: number;
  error: number;
};

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

const describeArc = (x: number, y: number, radius: number, angle1: number, angle2: number) => {
  const start = polarToCartesian(x, y, radius, angle1);
  const end = polarToCartesian(x, y, radius, angle2);
  const diff = angle2 - angle1;
  let normalizedDiff = diff % 360;
  if (normalizedDiff < 0) normalizedDiff += 360;
  if (Math.abs(normalizedDiff) < 0.001) return "";
  if (Math.abs(normalizedDiff - 360) < 0.001) {
    return `M ${x + radius} ${y} A ${radius} ${radius} 0 1 1 ${x + radius} ${y - 0.01}`;
  }
  const largeArcFlag = Math.abs(diff) <= 180 ? "0" : "1";
  const sweepFlag = diff > 0 ? "1" : "0";
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [difficulty, setDifficulty] = useState<Difficulty>('Normal');
  const [round, setRound] = useState(1);
  const [rounds, setRounds] = useState<RoundData[]>([]);
  
  const [targetAngle, setTargetAngle] = useState(0);
  const [baseAngle, setBaseAngle] = useState(0);
  const [dir, setDir] = useState(1);
  const [bgLineAngle, setBgLineAngle] = useState(0);
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [inputValue, setInputValue] = useState('');
  const [playPhase, setPlayPhase] = useState<PlayPhase>('animating_question');
  
  // Animations
  const [line1Anim, setLine1Anim] = useState(0);
  const [line2Anim, setLine2Anim] = useState(0);
  const [arcAnim, setArcAnim] = useState(0);
  const [currentAnimAngle, setCurrentAnimAngle] = useState(0);
  const [resultAnimFinished, setResultAnimFinished] = useState(false);
  const [resultStep, setResultStep] = useState(0);

  const generateQuestion = (diff: Difficulty) => {
    let target = 0;
    if (diff === 'Easy') target = Math.floor(Math.random() * 37) * 10;
    else if (diff === 'Normal') target = Math.floor(Math.random() * 73) * 5;
    else if (diff === 'Pro') target = Math.floor(Math.random() * 361);
    else if (diff === 'Hell') target = Math.floor(Math.random() * 3601) / 10;

    setTargetAngle(target);
    setBaseAngle(Math.floor(Math.random() * 360));
    setDir(Math.random() > 0.5 ? 1 : -1);
    setBgLineAngle(Math.floor(Math.random() * 91) - 45); // -45 to 45
    setStrokeWidth(Math.floor(Math.random() * 6) + 4);
    setInputValue('');
    setPlayPhase('animating_question');
    setLine1Anim(0);
    setLine2Anim(0);
    setArcAnim(0);
    setCurrentAnimAngle(0);
    setResultAnimFinished(false);
  };

  const startGame = (diff: Difficulty) => {
    setDifficulty(diff);
    setRound(1);
    setRounds([]);
    generateQuestion(diff);
    setGameState('playing');
  };

  useEffect(() => {
    if (playPhase === 'animating_question') {
      const runAnim = async () => {
        await animate(0, 1, { duration: 0.5, onUpdate: setLine1Anim, ease: "easeOut" });
        await animate(0, 1, { duration: 0.5, onUpdate: setLine2Anim, ease: "easeOut" });
        await animate(0, 1, { duration: 0.3, onUpdate: setArcAnim, ease: "easeOut" });
        setPlayPhase('input');
      };
      runAnim();
    }
  }, [playPhase]);

  useEffect(() => {
    if (playPhase === 'show_result') {
      const runAnim = async () => {
        const userAngle = parseInt(inputValue || '0');
        const maxAngle = Math.max(userAngle, targetAngle);
        await animate(0, maxAngle, { 
          duration: Math.max(1, maxAngle / 180), 
          onUpdate: setCurrentAnimAngle, 
          ease: "easeInOut" 
        });
        setResultAnimFinished(true);
      };
      runAnim();
    }
  }, [playPhase, inputValue, targetAngle]);

  useEffect(() => {
    if (gameState === 'result') {
      setResultStep(0);
      let step = 0;
      const interval = setInterval(() => {
        step++;
        setResultStep(step);
        if (step >= 6) clearInterval(interval);
      }, 300);
      return () => clearInterval(interval);
    }
  }, [gameState]);

  const handleNumClick = (n: number | string) => {
    if (n === '.') {
      if (inputValue.includes('.')) return;
      if (inputValue === '') {
        setInputValue('0.');
        return;
      }
    }
    const newValue = inputValue + n.toString();
    if (difficulty === 'Hell' && newValue.includes('.')) {
      const parts = newValue.split('.');
      if (parts[1] && parts[1].length > 1) return;
    }
    if (parseFloat(newValue) > 360) return;
    setInputValue(newValue);
  };

  const handleClear = () => {
    setInputValue('');
  };

  const handleEnter = () => {
    if (!inputValue) return;
    const userAngle = parseFloat(inputValue);
    const diff = Math.abs(userAngle - targetAngle);
    const error = Number(Math.min(diff, 360 - diff).toFixed(1));
    setRounds(prev => [...prev, { target: targetAngle, input: userAngle, error }]);
    setPlayPhase('show_result');
  };

  const handleNext = () => {
    if (playPhase !== 'show_result' || !resultAnimFinished) return;
    if (round < 3) {
      setRound(r => r + 1);
      generateQuestion(difficulty);
    } else {
      setGameState('result');
    }
  };

  const handleResultClick = () => {
    if (resultStep < 6) {
      setResultStep(6);
    } else {
      setGameState('start');
    }
  };

  if (gameState === 'start') {
    const modeDescriptions: Record<string, string> = {
      Easy: "Easyは10°刻みで\n出題されます。",
      Normal: "Normalは5°刻みで\n出題されます。",
      Pro: "Proは1°刻みで\n出題されます。",
      Hell: "Hellは0.1°刻みで\n出題されます。"
    };

    const modeColors: Record<string, string> = {
      Easy: "bg-green-500",
      Normal: "bg-orange-500",
      Pro: "bg-blue-500",
      Hell: "bg-red-500"
    };

    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-white text-black overflow-hidden">
        <h1 className="font-script text-[35vw] md:text-[20vw] leading-none m-0 p-0 select-none mt-8">deg.</h1>
        <div className="flex flex-col w-full mt-12">
          {(['Easy', 'Normal', 'Pro', 'Hell'] as Difficulty[]).map(diff => (
            <button 
              key={diff}
              onClick={() => startGame(diff)}
              className="relative w-full hover:bg-gray-50 transition-colors group"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-3 md:w-4 ${modeColors[diff]}`} />
              <div className="flex items-center justify-between w-full max-w-md mx-auto px-8 py-5">
                <span className="text-[10vw] md:text-[5vw] font-bold leading-none group-hover:opacity-70 transition-opacity">{diff}</span>
                <span className="text-sm md:text-base text-gray-500 text-right whitespace-pre-line leading-tight group-hover:opacity-70 transition-opacity">
                  {modeDescriptions[diff]}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (gameState === 'result') {
    const totalError = Number(rounds.reduce((sum, r) => sum + r.error, 0).toFixed(1));
    const score = 360 - totalError;
    let rank = '';
    if (score === 360 && (difficulty === 'Pro' || difficulty === 'Hell')) rank = 'SS';
    else if (score >= 340) rank = 'S';
    else if (score >= 300) rank = 'A';
    else if (score >= 240) rank = 'B';
    else if (score >= 180) rank = 'C';
    else if (score >= 100) rank = 'D';
    else rank = 'E';

    const modeColors: Record<string, string> = {
      Easy: "bg-green-500",
      Normal: "bg-orange-500",
      Pro: "bg-blue-500",
      Hell: "bg-red-500"
    };

    const modeDarkTextColors: Record<string, string> = {
      Easy: "text-green-950",
      Normal: "text-orange-950",
      Pro: "text-blue-950",
      Hell: "text-red-950"
    };

    return (
      <div className={`h-screen w-screen flex flex-col cursor-pointer p-4 md:p-8 font-sans relative overflow-hidden ${modeColors[difficulty]}`} onClick={handleResultClick}>
        
        {/* Header */}
        <div className={`flex justify-between items-end px-2 pb-4 pt-2 ${modeDarkTextColors[difficulty]}`}>
          <div className="text-4xl md:text-5xl font-black tracking-widest">RESULT</div>
          <div className="text-xl md:text-2xl font-bold tracking-widest uppercase">{difficulty}</div>
        </div>

        {/* Card */}
        <div className="flex-1 bg-white rounded-2xl flex flex-col items-center justify-center relative w-full shadow-2xl overflow-hidden">
          
          <div className={`text-[40vw] md:text-[20vw] leading-none select-none font-black absolute top-[10%] transition-opacity duration-300 ${resultStep >= 1 ? 'opacity-100' : 'opacity-0'}`}>
            {rank}
          </div>
          
          <div className={`text-4xl md:text-5xl font-bold select-none absolute top-[40%] transition-opacity duration-300 ${resultStep >= 2 ? 'opacity-100' : 'opacity-0'}`}>
            Score: {score}/360
          </div>

          <table className={`w-full max-w-md mx-auto text-center select-none absolute top-[55%] transition-opacity duration-300 ${resultStep >= 3 ? 'opacity-100' : 'opacity-0'}`}>
            <thead>
              <tr>
                <th className="pb-4 text-gray-500 text-base md:text-lg font-bold">Round 1</th>
                <th className="pb-4 text-gray-500 text-base md:text-lg font-bold">Round 2</th>
                <th className="pb-4 text-gray-500 text-base md:text-lg font-bold">Round 3</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {rounds.map((r, i) => {
                  const isPerfect = r.error < 0.1;
                  const errorDisplay = difficulty === 'Hell' ? r.error.toFixed(1).replace(/\.0$/, '') : r.error;
                  const errorText = isPerfect ? "±0°" : `${r.input > r.target ? '+' : '-'}${errorDisplay}°`;
                  return (
                    <td key={i} className={`text-3xl md:text-4xl font-bold ${isPerfect ? 'text-green-500' : 'text-red-500'}`}>
                      {errorText}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>

          <div className={`flex flex-col items-center select-none text-2xl md:text-3xl absolute top-[75%] transition-opacity duration-300 ${resultStep >= 4 ? 'opacity-100' : 'opacity-0'}`}>
            <div>
              360 - ({rounds.map(r => difficulty === 'Hell' ? r.error.toFixed(1).replace(/\.0$/, '') : r.error).join(' + ')})
            </div>
            <div className={`font-bold mt-4 transition-opacity duration-300 ${resultStep >= 5 ? 'opacity-100' : 'opacity-0'}`}>
              = {score}
            </div>
          </div>

          {resultStep >= 6 && (
            <motion.div 
              animate={{ opacity: [0, 1, 0] }} 
              transition={{ repeat: Infinity, duration: 1.5 }} 
              className="absolute bottom-6 text-lg md:text-xl text-gray-400 font-bold select-none"
            >
              Tap anywhere to continue...
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  const currentLine1Angle = baseAngle - 360 * dir * (1 - line1Anim);
  const currentLine2Angle = baseAngle + (360 + targetAngle) * dir * line2Anim;
  const currentArcAngle = targetAngle * arcAnim;

  const userAngle = parseFloat(inputValue || '0');
  const isUserPassed = currentAnimAngle >= userAngle;
  const isTargetPassed = currentAnimAngle >= targetAngle;

  const isPerfect = Math.abs(userAngle - targetAngle) < 0.1;
  const resultColor = isPerfect ? "#22c55e" : "#ef4444";
  const targetColor = isTargetPassed ? (isPerfect ? "#22c55e" : "black") : "#d1d5db";

  const modeColors: Record<string, string> = {
    Easy: "#22c55e", // green-500
    Normal: "#f97316", // orange-500
    Pro: "#3b82f6", // blue-500
    Hell: "#ef4444" // red-500
  };
  const bgLineColor = modeColors[difficulty] || "#e5e7eb";

  return (
    <motion.div layout className="flex flex-col h-screen w-screen bg-white text-black overflow-hidden">
      {/* SVG Area */}
      <motion.div 
        layout 
        className={`relative flex flex-col items-center justify-center w-full overflow-hidden ${playPhase === 'input' ? 'h-[60vh]' : 'h-full cursor-pointer'}`} 
        onClick={handleNext}
      >
        <div className="absolute top-4 left-4 text-[8vw] md:text-[3vw] text-gray-300 select-none z-10">
          {round} / 3
        </div>
        
        <svg viewBox="-130 -130 260 260" className="w-full h-full max-w-full p-0" preserveAspectRatio="xMidYMid meet">
          {playPhase === 'animating_question' && (
            <g strokeLinecap="butt" strokeLinejoin="round">
              {line1Anim === 1 ? (
                <path d={`M ${polarToCartesian(0,0,100, currentLine1Angle).x} ${polarToCartesian(0,0,100, currentLine1Angle).y} L 0 0 L ${polarToCartesian(0,0,100, currentLine2Angle).x} ${polarToCartesian(0,0,100, currentLine2Angle).y}`} fill="none" stroke="black" strokeWidth={strokeWidth} />
              ) : (
                <path d={`M 0 0 L ${polarToCartesian(0,0,100, currentLine1Angle).x} ${polarToCartesian(0,0,100, currentLine1Angle).y}`} fill="none" stroke="black" strokeWidth={strokeWidth} />
              )}
              {line2Anim === 1 && (
                <path d={describeArc(0,0,30, baseAngle, baseAngle + currentArcAngle * dir)} fill="none" stroke="black" strokeWidth={1} />
              )}
            </g>
          )}

          {playPhase === 'input' && (
            <g strokeLinecap="butt" strokeLinejoin="round">
              <path d={`M ${polarToCartesian(0,0,100, baseAngle).x} ${polarToCartesian(0,0,100, baseAngle).y} L 0 0 L ${polarToCartesian(0,0,100, baseAngle + targetAngle * dir).x} ${polarToCartesian(0,0,100, baseAngle + targetAngle * dir).y}`} fill="none" stroke="black" strokeWidth={strokeWidth} />
              <path d={describeArc(0,0,30, baseAngle, baseAngle + targetAngle * dir)} fill="none" stroke="black" strokeWidth={1} />
            </g>
          )}

          {playPhase === 'show_result' && (
            <g strokeLinecap="butt" strokeLinejoin="round">
              {/* 固定の第一線と第二線 (繋げて描画) */}
              <path d={`M ${polarToCartesian(0,0,100, baseAngle).x} ${polarToCartesian(0,0,100, baseAngle).y} L 0 0 L ${polarToCartesian(0,0,100, baseAngle + targetAngle * dir).x} ${polarToCartesian(0,0,100, baseAngle + targetAngle * dir).y}`} fill="none" stroke={targetColor} strokeWidth={strokeWidth} className="transition-colors duration-500" />
              
              {/* 固定の第一線 (色が違う場合の上書き用) */}
              {!isTargetPassed && !isPerfect && (
                <path d={`M 0 0 L ${polarToCartesian(0,0,100, baseAngle).x} ${polarToCartesian(0,0,100, baseAngle).y}`} fill="none" stroke="black" strokeWidth={strokeWidth} />
              )}
              
              {/* 固定の正解弧 */}
              <path d={describeArc(0,0,30, baseAngle, baseAngle + targetAngle * dir)} fill="none" stroke={targetColor} strokeWidth={1} className="transition-colors duration-500" />

              {/* ユーザーの線 */}
              {isUserPassed && (
                <path d={`M ${polarToCartesian(0,0,100, baseAngle).x} ${polarToCartesian(0,0,100, baseAngle).y} L 0 0 L ${polarToCartesian(0,0,100, baseAngle + userAngle * dir).x} ${polarToCartesian(0,0,100, baseAngle + userAngle * dir).y}`} fill="none" stroke={resultColor} strokeWidth={strokeWidth} />
              )}

              {/* 点線の弧 */}
              <path d={describeArc(0,0,40, baseAngle, baseAngle + Math.min(currentAnimAngle, userAngle) * dir)} fill="none" stroke={resultColor} strokeWidth={1} strokeDasharray="4 4" />

              {/* 回転する線 */}
              {!resultAnimFinished && (
                <path d={`M ${polarToCartesian(0,0,100, baseAngle).x} ${polarToCartesian(0,0,100, baseAngle).y} L 0 0 L ${polarToCartesian(0,0,100, baseAngle + currentAnimAngle * dir).x} ${polarToCartesian(0,0,100, baseAngle + currentAnimAngle * dir).y}`} fill="none" stroke="#9ca3af" strokeWidth={strokeWidth} />
              )}

              {/* テキスト群 */}
              {resultAnimFinished && (
                <>
                  <text x={polarToCartesian(0,0,115, baseAngle).x} y={polarToCartesian(0,0,115, baseAngle).y} dominantBaseline="middle" textAnchor="middle" fill={resultColor} fontSize="16" fontWeight="bold">
                    0°
                  </text>
                  <text x={polarToCartesian(0,0,115, baseAngle + userAngle * dir).x} y={polarToCartesian(0,0,115, baseAngle + userAngle * dir).y} dominantBaseline="middle" textAnchor="middle" fill={resultColor} fontSize="16" fontWeight="bold">
                    {userAngle}°
                  </text>
                  {!isPerfect && (
                    <text x={polarToCartesian(0,0,115, baseAngle + targetAngle * dir).x} y={polarToCartesian(0,0,115, baseAngle + targetAngle * dir).y} dominantBaseline="middle" textAnchor="middle" fill="black" fontSize="16" fontWeight="bold">
                      {targetAngle}°
                    </text>
                  )}
                </>
              )}
            </g>
          )}
        </svg>

        {playPhase === 'show_result' && resultAnimFinished && (
          <motion.div 
            animate={{ opacity: [0, 1, 0] }} 
            transition={{ repeat: Infinity, duration: 1.5 }} 
            className="absolute bottom-8 text-[5vw] md:text-[2vw] text-gray-500 select-none z-10"
          >
            Tap anywhere to continue...
          </motion.div>
        )}
      </motion.div>

      {/* Keyboard Area */}
      <AnimatePresence>
        {playPhase === 'input' && (
          <motion.div 
            initial={{ y: '100%' }} 
            animate={{ y: 0 }} 
            exit={{ y: '100%' }} 
            transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
            className="h-[40vh] w-full flex flex-col bg-gray-200 absolute bottom-0 left-0 right-0 overflow-hidden"
          >
            {/* Input Display (Ratio 2) */}
            <motion.div layoutId="input-display" className="flex-[2] flex items-center justify-center bg-white text-[8vh] font-bold select-none">
              {inputValue}<span className="text-gray-400">°</span>
            </motion.div>
            {/* Numpad (Ratio 4 total, 1 per row) */}
            <div className="flex-[4] grid grid-cols-3 grid-rows-4 gap-1 p-1 w-full bg-gray-200">
              {[7, 8, 9, 4, 5, 6, 1, 2, 3].map(n => (
                <button 
                  key={n} 
                  onClick={() => handleNumClick(n)} 
                  className="bg-white rounded-lg text-[3.5vh] font-bold active:scale-95 transition-transform select-none touch-manipulation flex items-center justify-center h-full w-full"
                >
                  {n}
                </button>
              ))}
              <button 
                onClick={handleClear} 
                className="bg-white text-red-500 rounded-lg text-[3.5vh] font-bold active:scale-95 transition-transform select-none touch-manipulation flex items-center justify-center h-full w-full"
              >
                C
              </button>
              {difficulty === 'Hell' ? (
                <div className="grid grid-cols-2 gap-1 h-full w-full">
                  <button 
                    onClick={() => handleNumClick(0)} 
                    className="bg-white rounded-lg text-[3.5vh] font-bold active:scale-95 transition-transform select-none touch-manipulation flex items-center justify-center h-full w-full"
                  >
                    0
                  </button>
                  <button 
                    onClick={() => handleNumClick('.')} 
                    className="bg-white rounded-lg text-[3.5vh] font-bold active:scale-95 transition-transform select-none touch-manipulation flex items-center justify-center h-full w-full"
                  >
                    .
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => handleNumClick(0)} 
                  className="bg-white rounded-lg text-[3.5vh] font-bold active:scale-95 transition-transform select-none touch-manipulation flex items-center justify-center h-full w-full"
                >
                  0
                </button>
              )}
              <button 
                onClick={handleEnter} 
                className="bg-blue-500 text-white rounded-lg text-[3vh] font-bold active:scale-95 transition-transform flex items-center justify-center select-none touch-manipulation h-full w-full"
              >
                Enter
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
