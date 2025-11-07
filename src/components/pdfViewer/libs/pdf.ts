import * as pdfjsLib from 'pdfjs-dist'
import './polyfill'

const fileEnv = JSON.parse(process.env.ALL_ENV || '{}') as {
  publicCDNHost: string
}
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${fileEnv.publicCDNHost}/resource/pdf.worker.min.mjs`
}

export default pdfjsLib
