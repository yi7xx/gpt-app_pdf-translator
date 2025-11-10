import PDFUploader from './PDFUploader'
import './index.css'

const InlineDisplayMode = () => {
  return (
    <div className="w-full overflow-hidden rounded-xl">
      <PDFUploader />
    </div>
  )
}

export default InlineDisplayMode
