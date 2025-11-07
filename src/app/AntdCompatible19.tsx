'use client'
import { AntdRegistry } from '@ant-design/nextjs-registry'
import '@ant-design/v5-patch-for-react-19'
import { FC } from 'react'

interface Props {
  children: React.ReactNode
}

const AntdCompatible: FC<Props> = ({ children }) => {
  return <AntdRegistry>{children}</AntdRegistry>
}

export default AntdCompatible
