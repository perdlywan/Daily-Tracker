import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Trophy, RefreshCw, Sparkles, Play, Pause, Timer } from 'lucide-react';

// --- Web Audio API Utility ---
// We create synthetic sounds to avoid broken external URL links.
let audioCtx = null;

const initAudio = () => {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

const playTimerSound = () => {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  
  // Create a double beep sound
  [0, 0.2].forEach(delay => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now + delay); // A5 note
    
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(0.5, now + delay + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + delay + 0.15);
    
    osc.start(now + delay);
    osc.stop(now + delay + 0.2);
  });
};

const playWinSound = () => {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  
  // Play a pleasant ascending arpeggio (C5, E5, G5, C6)
  const frequencies = [523.25, 659.25, 783.99, 1046.50];
  
  frequencies.forEach((freq, index) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.type = 'triangle';
    osc.frequency.value = freq;
    
    const startTime = now + (index * 0.15);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + 1.0);
    
    osc.start(startTime);
    osc.stop(startTime + 1.2);
  });
};

const confettiStyles = `
  @keyframes fall {
    0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
    100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
  }
  .confetti-piece {
    position: fixed;
    top: -10px;
    z-index: 50;
    pointer-events: none;
    animation: fall 3s linear forwards;
  }
`;

const Confetti = () => {
  const [pieces, setPieces] = useState([]);

  useEffect(() => {
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    const newPieces = Array.from({ length: 80 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}vw`,
      animationDuration: `${Math.random() * 2 + 2}s`,
      animationDelay: `${Math.random() * 0.5}s`,
      backgroundColor: colors[Math.floor(Math.random() * colors.length)],
      width: `${Math.random() * 8 + 6}px`,
      height: `${Math.random() * 12 + 8}px`,
      borderRadius: Math.random() > 0.5 ? '50%' : '2px'
    }));
    setPieces(newPieces);
  }, []);

  return (
    <>
      <style>{confettiStyles}</style>
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            animationDuration: p.animationDuration,
            animationDelay: p.animationDelay,
            backgroundColor: p.backgroundColor,
            width: p.width,
            height: p.height,
            borderRadius: p.borderRadius
          }}
        />
      ))}
    </>
  );
};

const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export default function DailyTracker() {
  const [tasks, setTasks] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [inputDuration, setInputDuration] = useState('');
  const [hasWon, setHasWon] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const isFirstRender = useRef(true);

  // Load from LocalStorage
  useEffect(() => {
    const savedTasks = localStorage.getItem('daily_quests_v3');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
    setIsLoaded(true);
  }, []);

  // Save to LocalStorage and Evaluate Win Condition
  useEffect(() => {
    if (!isLoaded) return;
    
    localStorage.setItem('daily_quests_v3', JSON.stringify(tasks));
    
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const isAllDone = total > 0 && total === completed;
    
    if (isAllDone && !hasWon) {
      setHasWon(true);
      // Ensure we don't play sound on page load if already won previously
      if (!isFirstRender.current) {
        playWinSound();
      }
    } else if (!isAllDone && hasWon) {
      setHasWon(false);
    }
    
    isFirstRender.current = false;
  }, [tasks, hasWon, isLoaded]);

  // Interval for ticking running timers
  useEffect(() => {
    const interval = setInterval(() => {
      setTasks(prevTasks => {
        let hasChanges = false;
        const newTasks = prevTasks.map(task => {
          if (task.isRunning && !task.completed && task.remainingTime > 0) {
            hasChanges = true;
            const newRemaining = task.remainingTime - 1;
            
            // Auto-complete when timer hits 0
            if (newRemaining <= 0) {
              playTimerSound(); // Trigger synthesized timer sound
              return { ...task, remainingTime: 0, isRunning: false, completed: true };
            }
            return { ...task, remainingTime: newRemaining };
          }
          return task;
        });
        
        return hasChanges ? newTasks : prevTasks;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleAddTask = (e) => {
    e.preventDefault();
    initAudio(); // Initialize audio context on first user interaction
    
    if (!inputValue.trim()) return;
    
    const durationMins = parseInt(inputDuration);
    const hasTimer = !isNaN(durationMins) && durationMins > 0;
    
    const newTask = {
      id: Date.now().toString(),
      text: inputValue.trim(),
      completed: false,
      hasTimer: hasTimer,
      duration: hasTimer ? durationMins : 0,
      remainingTime: hasTimer ? durationMins * 60 : 0,
      isRunning: false
    };
    
    setTasks([...tasks, newTask]);
    setInputValue('');
    setInputDuration('');
  };

  const toggleTask = (id) => {
    initAudio();
    setTasks(tasks.map(task => {
      if (task.id === id) {
        const isNowCompleted = !task.completed;
        return { 
          ...task, 
          completed: isNowCompleted,
          isRunning: isNowCompleted ? false : task.isRunning 
        };
      }
      return task;
    }));
  };

  const toggleTimer = (id) => {
    initAudio();
    setTasks(tasks.map(task => 
      task.id === id ? { ...task, isRunning: !task.isRunning } : task
    ));
  };

  const deleteTask = (id) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  const startNewDay = () => {
    initAudio();
    setTasks([]);
    setHasWon(false);
  };

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const progressPercentage = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  if (!isLoaded) return <div className="min-h-screen bg-slate-900"></div>;

  return (
    <div className="min-h-screen bg-slate-900 flex justify-center text-slate-800 font-sans selection:bg-indigo-200">
      {hasWon && <Confetti />}
      
      {/* Mobile container constraint */}
      <div className="w-full max-w-md bg-white min-h-screen shadow-2xl flex flex-col relative overflow-hidden">
        
        {/* Header */}
        <header className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-6 rounded-b-3xl shadow-lg z-10">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2 tracking-tight">
                <Sparkles className="w-6 h-6 text-yellow-300" />
                Daily Focus
              </h1>
              <p className="text-indigo-200 text-sm mt-1 opacity-90">Track your day, achieve more.</p>
            </div>
            {totalTasks > 0 && (
              <button 
                onClick={startNewDay}
                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full transition-all active:scale-90 backdrop-blur-sm"
                title="Reset All Tasks"
              >
                <RefreshCw className="w-5 h-5 text-white" />
              </button>
            )}
          </div>

          {/* Progress Section */}
          <div className="mt-2">
            <div className="flex justify-between text-sm font-medium mb-2 px-1">
              <span className="text-indigo-100">Completion</span>
              <span className="font-bold">{progressPercentage}%</span>
            </div>
            <div className="h-3 w-full bg-indigo-950/40 rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-300 rounded-full transition-all duration-700 ease-out relative"
                style={{ width: `${progressPercentage}%` }}
              >
                {/* Shine effect on progress bar */}
                <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/20 w-full h-full" style={{ maskImage: 'linear-gradient(to right, transparent, black)' }}></div>
              </div>
            </div>
          </div>
        </header>

        {/* Win Banner */}
        {hasWon && (
          <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-white p-5 flex flex-col items-center justify-center shadow-inner animate-in slide-in-from-top-4 duration-500 z-0">
            <Trophy className="w-10 h-10 mb-2 drop-shadow-md text-yellow-100" />
            <h2 className="text-xl font-bold tracking-wide drop-shadow-sm uppercase">You Win!</h2>
            <p className="text-sm font-medium text-amber-50 opacity-90 mt-1">Excellent work clearing your list today.</p>
          </div>
        )}

        {/* Main Content / Task List */}
        <main className="flex-1 overflow-y-auto p-5 pb-32 bg-slate-50">
          {totalTasks === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 animate-in fade-in duration-700">
              <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-2 shadow-sm">
                <CheckCircle2 className="w-10 h-10 text-indigo-200" />
              </div>
              <p className="text-center text-lg font-semibold text-slate-500">Your day is empty</p>
              <p className="text-center text-sm text-slate-400 max-w-[200px]">Add tasks below. Set a timer to stay focused on your goals!</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {tasks.map((task) => (
                <li 
                  key={task.id} 
                  className={`group flex flex-col p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
                    task.completed 
                      ? 'bg-slate-100 border-slate-200 opacity-70' 
                      : task.isRunning
                        ? 'bg-white border-indigo-300 shadow-md ring-1 ring-indigo-100 scale-[1.01]'
                        : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                  }`}
                >
                  {/* Active Timer Background Indicator */}
                  {task.isRunning && (
                     <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-l-2xl animate-pulse"></div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <button 
                      onClick={() => toggleTask(task.id)}
                      className="flex-1 flex items-start gap-3 text-left focus:outline-none mt-1"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0 transition-transform hover:scale-110" />
                      ) : (
                        <Circle className="w-6 h-6 text-slate-300 flex-shrink-0 group-hover:text-indigo-400 transition-colors" />
                      )}
                      <span className={`text-base font-medium transition-all ${
                        task.completed ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-700'
                      } leading-snug`}>
                        {task.text}
                      </span>
                    </button>
                    <button 
                      onClick={() => deleteTask(task.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors focus:outline-none flex-shrink-0 mt-[-4px]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Timer Controls */}
                  {task.hasTimer && (
                    <div className="flex items-center justify-between mt-4 pl-9">
                      <div className={`font-mono text-sm font-bold flex items-center gap-1.5 px-3 py-1 rounded-md ${
                        task.completed 
                          ? 'bg-slate-200 text-slate-500' 
                          : task.isRunning 
                            ? 'bg-indigo-100 text-indigo-700' 
                            : 'bg-slate-100 text-slate-600'
                      }`}>
                        <Timer className="w-4 h-4" />
                        {formatTime(task.remainingTime)}
                      </div>
                      
                      {!task.completed && (
                        <button
                          onClick={() => toggleTimer(task.id)}
                          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm active:scale-95 ${
                            task.isRunning 
                              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 ring-1 ring-amber-200' 
                              : 'bg-indigo-600 text-white hover:bg-indigo-700 ring-1 ring-indigo-700'
                          }`}
                        >
                          {task.isRunning ? (
                            <><Pause className="w-3 h-3 fill-current" /> Pause</>
                          ) : (
                            <><Play className="w-3 h-3 fill-current" /> {task.remainingTime < task.duration * 60 ? 'Resume' : 'Start'}</>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </main>

        {/* Input Form (Fixed Bottom) */}
        <div className="absolute bottom-0 w-full p-4 bg-white/80 backdrop-blur-xl border-t border-slate-200 z-20 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
          <form onSubmit={handleAddTask} className="flex gap-2 max-w-full">
            <div className="flex-1 flex bg-slate-100 rounded-full overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all shadow-inner border border-transparent focus-within:border-indigo-200">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Add a new task..."
                className="w-full bg-transparent text-slate-800 px-5 py-3.5 focus:outline-none font-medium text-sm"
              />
              <div className="w-[1px] bg-slate-300 my-2 opacity-50"></div>
              <input
                type="number"
                min="1"
                max="999"
                value={inputDuration}
                onChange={(e) => setInputDuration(e.target.value)}
                placeholder="Min"
                title="Optional duration in minutes"
                className="w-20 bg-transparent text-slate-800 px-2 py-3.5 focus:outline-none font-medium text-sm text-center placeholder:text-slate-400 placeholder:font-normal"
              />
            </div>
            <button 
              type="submit"
              disabled={!inputValue.trim()}
              className="bg-indigo-600 text-white rounded-full p-3 w-[52px] h-[52px] flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-md active:scale-90 shrink-0"
            >
              <Plus className="w-6 h-6 stroke-[2.5]" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}