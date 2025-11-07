declare module '*.svg' {
  interface SVGProps extends React.SVGProps<SVGSVGElement> {
    size?: string | number
    color?: string
  }
  const content: React.FC<SVGProps>
  export default content
}

declare module '*.svg?url' {
  export const src: string
}

declare module '*.svg?raw' {
  const content: string
  export default content
}
