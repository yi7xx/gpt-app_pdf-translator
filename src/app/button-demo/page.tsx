'use client'
import GPTButton from '@/components/GPTButton'
import React, { useState } from 'react'

// 图标组件示例
const PlusIcon = () => (
  <svg
    className="size-[18px]"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 4v16m8-8H4"
    />
  </svg>
)

const TrashIcon = () => (
  <svg
    className="size-[18px]"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
)

const DownloadIcon = () => (
  <svg
    className="size-[18px]"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
)

const HeartIcon = () => (
  <svg
    className="size-[18px]"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
    />
  </svg>
)

export const GPTButtonDemo: React.FC = () => {
  const [loading1, setLoading1] = useState(false)
  const [loading2, setLoading2] = useState(false)

  const handleClick1 = () => {
    setLoading1(true)
    setTimeout(() => setLoading1(false), 2000)
  }

  const handleClick2 = () => {
    setLoading2(true)
    setTimeout(() => setLoading2(false), 2000)
  }

  return (
    <div className="bg-grey-layer1-normal min-h-screen p-8">
      <div className="mx-auto max-w-7xl space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-text-primary-1 text-4xl font-bold">
            GPTButton Component Demo
          </h1>
          <p className="mt-2 text-gray-600">
            Explore different variants, sizes, and states
          </p>
        </div>

        {/* Variants Section */}
        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Variants
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="flex flex-wrap gap-4">
              <GPTButton variant="default">Default GPTButton</GPTButton>
              <GPTButton variant="secondary">Secondary GPTButton</GPTButton>
              <GPTButton variant="destructive">Destructive GPTButton</GPTButton>
              <GPTButton variant="sec-destructive">Sec Destructive</GPTButton>
            </div>
          </div>
        </section>

        {/* Sizes Section */}
        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">Sizes</h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <GPTButton size="default" variant="default">
                Default Size
              </GPTButton>
              <GPTButton size="small" variant="default">
                Small Size
              </GPTButton>
            </div>
          </div>
        </section>

        {/* With Icons Section */}
        <section className="shadow-shallow-near animate-fade-in2 space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            With Icons
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <GPTButton variant="default" icon={<PlusIcon />}>
                  Add Item
                </GPTButton>
                <GPTButton variant="secondary" icon={<DownloadIcon />}>
                  Download
                </GPTButton>
                <GPTButton
                  variant="destructive"
                  icon={<TrashIcon />}
                  iconPosition="right"
                >
                  Delete
                </GPTButton>
                <GPTButton
                  variant="sec-destructive"
                  icon={<HeartIcon />}
                  iconPosition="right"
                >
                  Like
                </GPTButton>
              </div>
              <div className="flex flex-wrap gap-4">
                <GPTButton size="small" variant="default" icon={<PlusIcon />}>
                  Small with Icon
                </GPTButton>
                <GPTButton
                  size="small"
                  variant="secondary"
                  icon={<DownloadIcon />}
                  iconPosition="right"
                >
                  Small Right Icon
                </GPTButton>
              </div>
            </div>
          </div>
        </section>

        {/* Icon Only Section */}
        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Icon Only
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="flex flex-wrap gap-4">
              <GPTButton variant="text" icon={<PlusIcon />} />
              <GPTButton variant="default" icon={<PlusIcon />} />
              <GPTButton variant="secondary" icon={<DownloadIcon />} />
              <GPTButton variant="destructive" icon={<TrashIcon />} />
              <GPTButton variant="sec-destructive" icon={<HeartIcon />} />
            </div>
          </div>
        </section>

        {/* Loading States Section */}
        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Loading States
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <GPTButton variant="default" loading>
                  Loading...
                </GPTButton>
                <GPTButton variant="secondary" loading>
                  Loading...
                </GPTButton>
                <GPTButton variant="destructive" loading>
                  Deleting...
                </GPTButton>
              </div>
              <div className="flex flex-wrap gap-4">
                <GPTButton variant="default" loading onClick={handleClick1}>
                  Click to Load
                </GPTButton>
                <GPTButton
                  variant="secondary"
                  loading={loading1}
                  onClick={handleClick1}
                >
                  {loading1 ? 'Saving...' : 'Save Changes'}
                </GPTButton>
              </div>
              <div className="flex flex-wrap gap-4">
                <GPTButton
                  variant="default"
                  loading={{ delay: 500 }}
                  onClick={handleClick2}
                >
                  Delayed Loading (500ms)
                </GPTButton>
                <GPTButton
                  variant="secondary"
                  loading={loading2}
                  onClick={handleClick2}
                  icon={<DownloadIcon />}
                >
                  {loading2 ? 'Downloading...' : 'Download File'}
                </GPTButton>
              </div>
            </div>
          </div>
        </section>

        {/* Disabled States Section */}
        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Disabled States
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="flex flex-wrap gap-4">
              <GPTButton variant="default" disabled>
                Disabled Default
              </GPTButton>
              <GPTButton variant="secondary" disabled>
                Disabled Secondary
              </GPTButton>
              <GPTButton variant="destructive" disabled>
                Disabled Destructive
              </GPTButton>
              <GPTButton variant="sec-destructive" disabled>
                Disabled Sec
              </GPTButton>
            </div>
          </div>
        </section>

        {/* Full Width Section */}
        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Full Width
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="space-y-4">
              <GPTButton variant="default" block>
                Full Width Default
              </GPTButton>
              <GPTButton variant="secondary" block icon={<DownloadIcon />}>
                Full Width with Icon
              </GPTButton>
              <GPTButton
                variant="destructive"
                block
                icon={<TrashIcon />}
                iconPosition="right"
              >
                Full Width Right Icon
              </GPTButton>
            </div>
          </div>
        </section>

        {/* Custom Styling Section */}
        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Custom Styling
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="flex flex-wrap gap-4">
              <GPTButton
                variant="default"
                className="shadow-lg hover:shadow-xl"
                icon={<PlusIcon />}
              >
                Custom Shadow
              </GPTButton>
              <GPTButton
                variant="secondary"
                classNames={{ icon: 'text-blue-500' }}
                icon={<HeartIcon />}
              >
                Custom Icon Color
              </GPTButton>
              <GPTButton
                variant="default"
                styles={{ icon: { transform: 'rotate(45deg)' } }}
                icon={<PlusIcon />}
              >
                Rotated Icon
              </GPTButton>
            </div>
          </div>
        </section>

        {/* Real World Examples Section */}
        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Real World Examples
          </h2>
          <div className="space-y-6">
            {/* Form Actions */}
            <div className="rounded-lg  p-6 shadow-sm">
              <h3 className="text-text-primary-1 mb-4 text-lg font-medium">
                Form Actions
              </h3>
              <div className="flex justify-end gap-3">
                <GPTButton variant="secondary">Cancel</GPTButton>
                <GPTButton variant="default" icon={<DownloadIcon />}>
                  Save
                </GPTButton>
              </div>
            </div>

            {/* Delete Confirmation */}
            <div className="rounded-lg  p-6 shadow-sm">
              <h3 className="text-text-primary-1 mb-4 text-lg font-medium">
                Delete Confirmation
              </h3>
              <div className="space-y-3">
                <p className="text-gray-600">
                  Are you sure you want to delete this item? This action cannot
                  be undone.
                </p>
                <div className="flex gap-3">
                  <GPTButton variant="secondary">Cancel</GPTButton>
                  <GPTButton variant="destructive" icon={<TrashIcon />}>
                    Delete
                  </GPTButton>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="rounded-lg  p-6 shadow-sm">
              <h3 className="text-text-primary-1 mb-4 text-lg font-medium">
                Action Bar
              </h3>
              <div className="flex flex-wrap gap-2">
                <GPTButton size="small" variant="default" icon={<PlusIcon />}>
                  New
                </GPTButton>
                <GPTButton
                  size="small"
                  variant="secondary"
                  icon={<DownloadIcon />}
                >
                  Export
                </GPTButton>
                <GPTButton size="small" variant="secondary">
                  Filter
                </GPTButton>
                <GPTButton
                  size="small"
                  variant="sec-destructive"
                  icon={<TrashIcon />}
                >
                  Delete Selected
                </GPTButton>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default GPTButtonDemo
