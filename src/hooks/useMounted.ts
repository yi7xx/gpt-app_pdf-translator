import { useEffect, useState } from 'react'

/**
 * 判断组件是否已挂载
 */
export default function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}
