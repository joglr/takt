import { ChangeEvent, useEffect, useMemo, useState } from "react";
import clsx from "clsx";

import kick from "./assets/kick.mp3";
import snare from "./assets/snare.mp3";
import clap from "./assets/clap.mp3";
import hiHat from "./assets/hi-hat.mp3";

import { flushSync } from "react-dom";
import { useLocalStorage } from "./hooks";

const boardWidth = 16;

type Sound = {
  name: string;
  audio: HTMLAudioElement;
  credit: string;
  offset: number;
  color: string;
};

export default function App() {
  const [savedBeats, setSavedBeats] = useLocalStorage<
    {
      name: string;
      pattern: Record<string, boolean[]>;
      bpm: number;
      volumes: number[];
    }[]
  >("beats", []);
  const [bpm, setBpm] = useState(() => 200);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentCol, setCurrentCol] = useState(0);
  const sounds = useMemo<Sound[]>(() => {
    const sounds: Sound[] = [
      {
        name: "Kick",
        audio: new Audio(kick),
        credit: "cymatics.fm",
        offset: 0,
        color: "bg-red-500",
      },
      {
        name: "Hi Hat",
        audio: new Audio(hiHat),
        credit: "samplefocus.com",
        offset: 0.08,
        color: "bg-green-500",
      },
      {
        name: "Snare",
        audio: new Audio(snare),
        credit: "cymatics.fm",
        offset: 0,
        color: "bg-blue-500",
      },
      {
        name: "Clap",
        audio: new Audio(clap),
        credit: "samplefocus.com",
        offset: 0,
        color: "bg-yellow-500",
      },
    ];

    sounds.forEach((sound) => {
      sound.audio.preload = "auto";
    });
    return sounds;
  }, []);

  const [board, setBoard] = useState<Record<string, boolean[]>>(() =>
    initializeBoard(sounds)
  );

  const boardHeight = useMemo(() => sounds.length, [sounds]);

  const [mutes, setMutes] = useState(() => {
    const mutes: boolean[] = [];
    for (let i = 0; i < boardHeight; i++) {
      mutes.push(false);
    }
    return mutes;
  });

  const [volumes, setVolumes] = useState(() => {
    const volumes = new URL(window.location.toString()).searchParams.get(
      "volumes"
    );
    if (volumes) {
      return volumes.split(",").map((volume) => Number(volume));
    }
    return sounds.map(() => 0.5);
  });

  useEffect(() => {
    function keyUpListener(e: KeyboardEvent) {
      if (e.key === " ") {
        flushSync(() => {
          setCurrentCol(0);
          setIsPlaying((prev) => !prev);
        });
        return;
      }
    }
    window.addEventListener("keyup", keyUpListener);
    return () => {
      window.removeEventListener("keyup", keyUpListener);
    };
  });

  useEffect(() => {
    if (!isPlaying) return;
    let canceled = false;
    const interval = setInterval(() => {
      if (canceled) return;
      let col = 0;
      let mutedSounds: boolean[] = [];
      flushSync(() => {
        setCurrentCol((prev) => {
          col = prev;
          return (prev + 1) % boardWidth;
        });
        setMutes(() => {
          mutedSounds = [...mutes];
          return mutedSounds;
        });
      });

      Object.entries(board).forEach(([soundName]) => {
        const sound = sounds.find((x) => x.name === soundName);
        if (!sound) return;
        sound.audio.pause();
        sound.audio.currentTime = sound.offset;
      });

      Object.entries(board).forEach(([soundName, beats], idx) => {
        const sound = sounds.find((x) => x.name === soundName);
        if (!sound) return;
        const value = beats[col];
        if (value && !mutedSounds[idx]) {
          sound.audio.play();
        }
      });
    }, (60 / (bpm * 2)) * 1000);
    return () => {
      canceled = true;
      clearInterval(interval);
    };
  }, [board, bpm, isPlaying, mutes, sounds]);

  useEffect(() => {
    sounds.forEach((sound, idx) => {
      sound.audio.volume = volumes[idx];
    });
  }, [sounds, volumes]);

  const fillWithPattern = (soundName: string, step: number, skip: number) => {
    const pattern = generatePattern(boardWidth, step, skip);

    return setBoard((prev) => ({
      ...prev,
      [soundName]:
        prev[soundName].join("") === pattern.join("")
          ? new Array(boardWidth).fill(false)
          : pattern,
    }));
  };
  return (
    <div className="h-screen w-screen bg-slate-600 text-white/80">
      <header className="flex gap-2 bg-slate-900 p-2">
        <button
          className={clsx("rounded px-2 py-1", {
            "bg-green-700": isPlaying,
            "bg-red-700": !isPlaying,
          })}
          onClick={() => setIsPlaying((prev) => !prev)}
        >
          ⏯️
        </button>
        <input
          className="rounded bg-slate-900 px-2 py-1"
          type="number"
          value={bpm}
          min={1}
          max={300}
          onKeyUp={(e) => {
            e.stopPropagation();
          }}
          onChange={(e) => {
            setBpm(Number(e.target.value));
          }}
        />
        <button
          className="rounded border border-white/50 px-2 py-1"
          onClick={() => {
            const name = prompt(
              "Name of beat?",
              `Untitled ${savedBeats.length + 1}`
            );
            if (!name) return;
            setSavedBeats((prev) => [
              ...prev,
              { name, pattern: board, bpm, volumes },
            ]);
            setBoard(initializeBoard(sounds));
          }}
        >
          Save as new beat
        </button>
        <button
          className="rounded bg-slate-900 px-2 py-1"
          onClick={() => {
            setBoard(initializeBoard(sounds));
            setVolumes(sounds.map(() => 0.5));
            setIsPlaying(false);
            setCurrentCol(0);
          }}
        >
          Reset
        </button>
      </header>
      <div className="grid grid-cols-[auto,1fr]">
        <div className="grid-ros-4 grid place-items-stretch gap-2 p-2">
          {sounds.map((sound, idx) => (
            <div key={idx} className="grid gap-2">
              <div className="grid grid-cols-[auto,1fr,auto,auto,auto,auto,auto] items-center gap-2">
                <button
                  onClick={() => {
                    setMutes((prev) => {
                      const newMutes = [...prev];
                      newMutes[idx] = !newMutes[idx];
                      return newMutes;
                    });
                  }}
                  className="rounded bg-slate-900 px-2 py-1"
                  title="Mute / Unmute"
                >
                  {mutes[idx] ? "🔇" : "🔊"}
                </button>
                <button
                  onClick={() => {
                    sound.audio.pause();
                    sound.audio.currentTime = sound.offset;
                    sound.audio.play();
                  }}
                  className="rounded bg-slate-900 px-2 py-1 text-left"
                  title={`Click to preview. Credit: ${sound.credit}`}
                >
                  <b>⏯️ {sound.name}</b>
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volumes[idx]}
                  onDoubleClick={() => {
                    setVolumes((prev) => {
                      const next = [...prev];
                      next[idx] = 0.5;
                      return next;
                    });
                  }}
                  onInput={(e: ChangeEvent<HTMLInputElement>) => {
                    setVolumes((prev) => {
                      const next = [...prev];
                      next[idx] = Number(e.target.value);
                      return next;
                    });
                  }}
                />
                <button
                  className="rounded bg-slate-900 px-2 py-1"
                  onClick={() => fillWithPattern(sound.name, 1, 0)}
                >
                  1
                </button>
                <button
                  className="rounded bg-slate-900 px-2 py-1"
                  onClick={(evt) =>
                    fillWithPattern(sound.name, 2, evt.shiftKey ? 1 : 0)
                  }
                >
                  2
                </button>
                <button
                  className="rounded bg-slate-900 px-2 py-1"
                  onClick={(evt) =>
                    fillWithPattern(sound.name, 4, evt.shiftKey ? 2 : 0)
                  }
                >
                  4
                </button>
                <button
                  className="rounded bg-slate-900 px-2 py-1"
                  onClick={(evt) =>
                    fillWithPattern(sound.name, 8, evt.shiftKey ? 4 : 0)
                  }
                >
                  8
                </button>
              </div>
            </div>
          ))}
        </div>
        <div
          className="grid gap-2 p-2"
          style={{
            aspectRatio: `${boardWidth}/${boardHeight}`,
            gridTemplateColumns: `repeat(${boardWidth}, 1fr)`,
            gridTemplateRows: `repeat(${boardHeight}, 1fr)`,
          }}
        >
          {Object.entries(board).map(([soundName, beats]) => {
            const sound = sounds.find((x) => x.name === soundName);
            if (!sound) return null;
            return (
              <>
                {beats.map((isEnabled, idx) => {
                  const isPlayingThis = isPlaying && idx === currentCol;
                  const isHighlighted = isEnabled;
                  return (
                    <button
                      key={`${soundName}-${idx}}-${isEnabled}`}
                      className={clsx(
                        "grid place-items-center rounded bg-gradient-radial from-white/50 to-white/30 shadow-md transition-all hover:opacity-80 active:opacity-80",
                        isPlayingThis
                          ? "bg-slate-900"
                          : isHighlighted
                          ? sound.color
                          : "bg-slate-700",
                        {
                          "opacity-50": mutes[sounds.indexOf(sound)],
                        }
                      )}
                      onClick={() => {
                        const newRow = [...beats];
                        newRow[idx] = !newRow[idx];
                        setBoard((prev) => ({
                          ...prev,
                          [soundName]: newRow,
                        }));
                      }}
                    />
                  );
                })}
              </>
            );
          })}
        </div>
        <div>
          <h2 className="p-2 font-bold uppercase tracking-[0.3rem] opacity-60">
            Saved beats
          </h2>
          <ul className="flex flex-col gap-2 p-2">
            {savedBeats.map((beat, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <button
                  className="rounded bg-slate-900 px-2 py-1"
                  onClick={() => {
                    setBoard(beat.pattern);
                    setBpm(beat.bpm);
                  }}
                >
                  Load
                </button>
                <button
                  className="rounded bg-slate-900 px-2 py-1"
                  onClick={() => {
                    if (
                      confirm(
                        `Are you sure you want to overwrite ${beat.name}?`
                      )
                    ) {
                      setSavedBeats((prev) => {
                        const next = [...prev];
                        next[idx] = {
                          name: beat.name,
                          pattern: board,
                          bpm,
                          volumes,
                        };
                        return next;
                      });
                    }
                  }}
                >
                  Save
                </button>
                <button
                  className="rounded bg-red-900 px-2 py-1"
                  onClick={() => {
                    if (
                      confirm(`Are you sure you want to delete ${beat.name}?`)
                    ) {
                      setSavedBeats((prev) => {
                        const next = [...prev];
                        next.splice(idx, 1);
                        return next;
                      });
                    }
                  }}
                >
                  Delete
                </button>
                <button
                  onClick={() => {
                    const newName = prompt("New name", beat.name);
                    if (newName) {
                      setSavedBeats((prev) => {
                        const next = [...prev];
                        next[idx] = {
                          ...beat,
                          name: newName,
                        };
                        return next;
                      });
                    }
                  }}
                  title="Click to rename"
                >
                  {beat.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function generatePattern(width: number, skip: number, offset: number) {
  const pattern = new Array(width).fill(false);
  for (let i = 0; i < width; i++) {
    if (i % skip === offset) {
      pattern[i] = true;
    }
  }
  return pattern;
}

function initializeBoard(sounds: Sound[]) {
  return sounds.reduce((acc, sound) => {
    acc[sound.name] = new Array(boardWidth).fill(false);
    return acc;
  }, {} as Record<string, boolean[]>);
}
