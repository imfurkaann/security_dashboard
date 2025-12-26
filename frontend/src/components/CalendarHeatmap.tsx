import { useMemo } from 'react';

interface HeatmapData {
    date: string;
    count: number;
}

interface CalendarHeatmapProps {
    data: HeatmapData[];
    startDate: Date;
    endDate: Date;
}

const CalendarHeatmap = ({ data, startDate, endDate }: CalendarHeatmapProps) => {
    const heatmapData = useMemo(() => {
        const dataMap = new Map(data.map(d => [d.date, d.count]));
        const days: { date: Date; count: number }[] = [];

        const current = new Date(startDate);
        while (current <= endDate) {
            const dateStr = current.toISOString().split('T')[0];
            days.push({
                date: new Date(current),
                count: dataMap.get(dateStr) || 0
            });
            current.setDate(current.getDate() + 1);
        }

        return days;
    }, [data, startDate, endDate]);

    const maxCount = Math.max(...heatmapData.map(d => d.count), 1);

    const getColor = (count: number) => {
        if (count === 0) return '#ebedf0';
        const intensity = count / maxCount;
        if (intensity < 0.25) return '#9be9a8';
        if (intensity < 0.5) return '#40c463';
        if (intensity < 0.75) return '#30a14e';
        return '#216e39';
    };

    const weeks: { date: Date; count: number }[][] = [];
    let currentWeek: { date: Date; count: number }[] = [];

    heatmapData.forEach((day, index) => {
        currentWeek.push(day);
        if (day.date.getDay() === 6 || index === heatmapData.length - 1) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    });

    return (
        <div className="overflow-x-auto">
            <div className="inline-flex gap-1 p-4">
                {weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-1">
                        {week.map((day, dayIndex) => (
                            <div
                                key={dayIndex}
                                className="w-3 h-3 rounded-sm relative group cursor-pointer"
                                style={{ backgroundColor: getColor(day.count) }}
                                title={`${day.date.toLocaleDateString('tr-TR')}: ${day.count} kullanım`}
                            >
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                                    {day.date.toLocaleDateString('tr-TR')}: {day.count}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-2 px-4 pb-4 text-xs text-gray-600">
                <span>Daha az</span>
                <div className="flex gap-1">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#ebedf0' }}></div>
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#9be9a8' }}></div>
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#40c463' }}></div>
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#30a14e' }}></div>
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#216e39' }}></div>
                </div>
                <span>Daha çok</span>
            </div>
        </div>
    );
};

export default CalendarHeatmap;
