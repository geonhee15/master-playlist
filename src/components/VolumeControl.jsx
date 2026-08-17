import { useState } from 'react'
import { getVolume, setVolume } from '../volume.js'
import { VolumeIcon } from './Icons.jsx'

// 모든 페이지 우상단에 고정되는 음량 조절 슬라이더
export default function VolumeControl() {
  const [value, setValue] = useState(getVolume())
  const [lastNonZero, setLastNonZero] = useState(getVolume() || 1)

  const apply = (v) => {
    setValue(v)
    setVolume(v)
    if (v > 0) setLastNonZero(v)
  }

  return (
    <div className="volume-control" title="음량">
      <button
        className="volume-icon"
        onClick={() => apply(value > 0 ? 0 : lastNonZero)}
        title={value > 0 ? '음소거' : '음소거 해제'}
      >
        <VolumeIcon size={15} muted={value === 0} />
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={value}
        onChange={(e) => apply(Number(e.target.value))}
      />
    </div>
  )
}
