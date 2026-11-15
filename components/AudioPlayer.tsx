import React, { useState, useRef, useEffect } from 'react';

interface AudioPlayerProps {
  src: string;
  isMe: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
    };

    const setAudioTime = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('durationchange', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('durationchange', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = Number(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 min-w-[200px] w-full max-w-[250px] py-1 px-1">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button 
        onClick={togglePlayPause}
        className={`w-10 h-10 flex items-center justify-center rounded-full shrink-0 shadow-sm transition-transform active:scale-95 ${isMe ? 'bg-black text-[#FFC90E]' : 'bg-black text-white'}`}
      >
        <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'} ${!isPlaying ? 'ml-1' : ''} text-base`}></i>
      </button>
      <div className="flex-1 flex flex-col justify-center">
        <input 
          type="range" 
          min={0} 
          max={duration || 100} 
          value={currentTime} 
          onChange={handleSeek}
          className={`w-full h-1.5 rounded-full appearance-none cursor-pointer ${isMe ? 'bg-black/10 accent-black' : 'bg-white/50 accent-[#D4A60A]'}`}
          style={{
             WebkitAppearance: 'none',
             background: `linear-gradient(to right, ${isMe ? '#000000' : '#A88C15'} ${(currentTime / (duration || 1)) * 100}%, ${isMe ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.1)'} ${(currentTime / (duration || 1)) * 100}%)`
          }}
        />
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] opacity-60 font-medium tracking-wide">{formatTime(currentTime)}</span>
          <span className="text-[10px] opacity-60 font-medium tracking-wide">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};
