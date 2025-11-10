import { baseURL } from '@/baseUrl'
import * as pdfjsLib from 'pdfjs-dist'
import './polyfill'

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `${baseURL}/pdfjs/pdf.worker.min.mjs`
}

export default pdfjsLib
