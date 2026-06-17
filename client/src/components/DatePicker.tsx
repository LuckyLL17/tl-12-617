import { useState, useRef, useEffect } from 'react';

interface DatePickerProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  days?: number;
}

export default function DatePicker({ selectedDate, onDateChange, days = 7 }: DatePickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const dates = Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date.toISOString().split('T')[0];
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    if (dateStr === today) return '今天';
    if (dateStr === tomorrow) return '明天';
    return `${date.getMonth() + 1}月${date.getDate()}日 ${weekDays[date.getDay()]}`;
  };

  const formatShortDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    if (dateStr === today) return '今天';
    if (dateStr === tomorrow) return '明天';
    return `${date.getMonth() + 1}/${date.getDate()} 周${weekDays[date.getDay()]}`;
  };

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;
    
    const activeButton = scrollContainer.querySelector('.date-btn-active');
    if (activeButton) {
      const containerWidth = scrollContainer.clientWidth;
      const buttonLeft = (activeButton as HTMLElement).offsetLeft;
      const buttonWidth = (activeButton as HTMLElement).offsetWidth;
      const targetScroll = buttonLeft - containerWidth / 2 + buttonWidth / 2;
      scrollContainer.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
    }
  }, [selectedDate]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;
    
    if (Math.abs(diff) > threshold) {
      const currentIndex = dates.indexOf(selectedDate);
      if (diff > 0 && currentIndex < dates.length - 1) {
        onDateChange(dates[currentIndex + 1]);
      } else if (diff < 0 && currentIndex > 0) {
        onDateChange(dates[currentIndex - 1]);
      }
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const currentIndex = dates.indexOf(selectedDate);
    if (e.deltaX > 20 && currentIndex < dates.length - 1) {
      onDateChange(dates[currentIndex + 1]);
    } else if (e.deltaX < -20 && currentIndex > 0) {
      onDateChange(dates[currentIndex - 1]);
    }
  };

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 px-1"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {dates.map(date => (
          <button
            key={date}
            onClick={() => onDateChange(date)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all duration-200 scroll-snap-align-center ${
              selectedDate === date
                ? 'date-btn-active bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30 scale-105'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <div className="text-sm font-medium">{formatShortDate(date)}</div>
          </button>
        ))}
      </div>
      
      {dates.indexOf(selectedDate) > 0 && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-full bg-gradient-to-r from-gray-50 to-transparent pointer-events-none">
          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow flex items-center justify-center text-gray-400 text-xs">
            ◀
          </div>
        </div>
      )}
      
      {dates.indexOf(selectedDate) < dates.length - 1 && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-full bg-gradient-to-l from-gray-50 to-transparent pointer-events-none">
          <div className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-white rounded-full shadow flex items-center justify-center text-gray-400 text-xs">
            ▶
          </div>
        </div>
      )}
    </div>
  );
}
