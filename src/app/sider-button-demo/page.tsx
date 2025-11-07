'use client'
import SiderButton from '@/components/SiderButton'
import React, { useState } from 'react'

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

const SearchIcon = () => (
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
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
)

const SettingsIcon = () => (
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
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
)

export const SiderButtonDemo: React.FC = () => {
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
        <div className="text-center">
          <h1 className="text-text-primary-1 text-4xl font-bold">
            SiderButton Component Demo
          </h1>
          <p className="mt-2 text-gray-600">
            Explore different types, colors, sizes, and shapes
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Button Types
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="flex flex-wrap gap-4">
              <SiderButton type="primary">Primary Button</SiderButton>
              <SiderButton type="default">Default Button</SiderButton>
              <SiderButton type="text">Text Button</SiderButton>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Button Colors
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                  Primary Type with Colors
                </h3>
                <div className="flex flex-wrap gap-4">
                  <SiderButton type="primary" color="brand">
                    Brand Color
                  </SiderButton>
                  <SiderButton type="primary" color="advanced">
                    Advanced Color
                  </SiderButton>
                  <SiderButton type="primary" color="grey">
                    Grey Color
                  </SiderButton>
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                  Default Type with Colors
                </h3>
                <div className="flex flex-wrap gap-4">
                  <SiderButton type="default" color="brand">
                    Brand Color
                  </SiderButton>
                  <SiderButton type="default" color="advanced">
                    Advanced Color
                  </SiderButton>
                  <SiderButton type="default" color="grey">
                    Grey Color
                  </SiderButton>
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                  Text Type with Colors
                </h3>
                <div className="flex flex-wrap gap-4">
                  <SiderButton type="text" color="brand">
                    Brand Color
                  </SiderButton>
                  <SiderButton type="text" color="advanced">
                    Advanced Color
                  </SiderButton>
                  <SiderButton type="text" color="grey">
                    Grey Color
                  </SiderButton>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Button Sizes
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <SiderButton type="primary" size="small">
                Small Size
              </SiderButton>
              <SiderButton type="primary" size="middle">
                Middle Size
              </SiderButton>
              <SiderButton type="primary" size="large">
                Large Size
              </SiderButton>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Button Shapes
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4">
                <SiderButton type="primary" shape="default">
                  Default Shape
                </SiderButton>
                <SiderButton type="primary" shape="round">
                  Round Shape
                </SiderButton>
                <SiderButton
                  type="primary"
                  shape="circle"
                  icon={<PlusIcon />}
                />
                <SiderButton
                  type="primary"
                  shape="circle"
                  icon={<SearchIcon />}
                />
                <SiderButton
                  type="primary"
                  shape="circle"
                  icon={<SettingsIcon />}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            With Icons
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                  Icon at Start (Default)
                </h3>
                <div className="flex flex-wrap gap-4">
                  <SiderButton type="primary" icon={<PlusIcon />}>
                    Add Item
                  </SiderButton>
                  <SiderButton type="default" icon={<DownloadIcon />}>
                    Download
                  </SiderButton>
                  <SiderButton type="text" icon={<SearchIcon />}>
                    Search
                  </SiderButton>
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                  Icon at End
                </h3>
                <div className="flex flex-wrap gap-4">
                  <SiderButton
                    type="primary"
                    icon={<PlusIcon />}
                    iconPosition="end"
                  >
                    Add Item
                  </SiderButton>
                  <SiderButton
                    type="default"
                    icon={<DownloadIcon />}
                    iconPosition="end"
                  >
                    Download
                  </SiderButton>
                  <SiderButton
                    type="text"
                    icon={<SearchIcon />}
                    iconPosition="end"
                  >
                    Search
                  </SiderButton>
                </div>
              </div>
              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                  Icon Only
                </h3>
                <div className="flex flex-wrap gap-4">
                  <SiderButton type="primary" icon={<PlusIcon />} />
                  <SiderButton type="default" icon={<DownloadIcon />} />
                  <SiderButton type="text" icon={<SearchIcon />} />
                  <SiderButton type="primary" icon={<HeartIcon />} />
                  <SiderButton type="default" icon={<SettingsIcon />} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Loading States
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4">
                <SiderButton type="primary" loading>
                  Loading...
                </SiderButton>
                <SiderButton type="default" loading>
                  Loading...
                </SiderButton>
                <SiderButton type="text" loading>
                  Loading...
                </SiderButton>
              </div>
              <div className="flex flex-wrap gap-4">
                <SiderButton
                  type="primary"
                  loading={loading1}
                  onClick={handleClick1}
                >
                  {loading1 ? 'Saving...' : 'Save Changes'}
                </SiderButton>
                <SiderButton
                  type="default"
                  loading={loading2}
                  onClick={handleClick2}
                  icon={<DownloadIcon />}
                >
                  {loading2 ? 'Downloading...' : 'Download File'}
                </SiderButton>
              </div>
              <div className="flex flex-wrap gap-4">
                <SiderButton type="primary" loading icon={<PlusIcon />}>
                  With Icon
                </SiderButton>
                <SiderButton type="default" loading={{ delay: 500 }}>
                  Delayed Loading (500ms)
                </SiderButton>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Disabled States
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="flex flex-wrap gap-4">
              <SiderButton type="primary" disabled>
                Disabled Primary
              </SiderButton>
              <SiderButton type="default" disabled>
                Disabled Default
              </SiderButton>
              <SiderButton type="text" disabled>
                Disabled Text
              </SiderButton>
              <SiderButton type="primary" disabled icon={<PlusIcon />}>
                With Icon
              </SiderButton>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Block (Full Width)
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="space-y-4">
              <SiderButton type="primary" block>
                Full Width Primary
              </SiderButton>
              <SiderButton type="default" block icon={<DownloadIcon />}>
                Full Width with Icon
              </SiderButton>
              <SiderButton
                type="text"
                block
                icon={<SearchIcon />}
                iconPosition="end"
              >
                Full Width Text with Right Icon
              </SiderButton>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Button Groups
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="space-y-6">
              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                  Basic Button Group
                </h3>
                <SiderButton.Group>
                  <SiderButton type="primary">Left</SiderButton>
                  <SiderButton type="primary">Middle</SiderButton>
                  <SiderButton type="primary">Right</SiderButton>
                </SiderButton.Group>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                  Button Group with Icons
                </h3>
                <SiderButton.Group>
                  <SiderButton type="default" icon={<PlusIcon />}>
                    Add
                  </SiderButton>
                  <SiderButton type="default" icon={<DownloadIcon />}>
                    Download
                  </SiderButton>
                  <SiderButton type="default" icon={<TrashIcon />}>
                    Delete
                  </SiderButton>
                </SiderButton.Group>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                  Button Group with Different Sizes
                </h3>
                <div className="space-y-3">
                  <SiderButton.Group size="small">
                    <SiderButton type="primary">Small</SiderButton>
                    <SiderButton type="primary">Small</SiderButton>
                    <SiderButton type="primary">Small</SiderButton>
                  </SiderButton.Group>
                  <SiderButton.Group size="middle">
                    <SiderButton type="primary">Middle</SiderButton>
                    <SiderButton type="primary">Middle</SiderButton>
                    <SiderButton type="primary">Middle</SiderButton>
                  </SiderButton.Group>
                  <SiderButton.Group size="large">
                    <SiderButton type="primary">Large</SiderButton>
                    <SiderButton type="primary">Large</SiderButton>
                    <SiderButton type="primary">Large</SiderButton>
                  </SiderButton.Group>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                  Block Button Group
                </h3>
                <SiderButton.Group block>
                  <SiderButton type="primary">Left</SiderButton>
                  <SiderButton type="primary">Middle</SiderButton>
                  <SiderButton type="primary">Right</SiderButton>
                </SiderButton.Group>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                  Button Group with Split Color
                </h3>
                <SiderButton.Group splitColor="#e5e7eb">
                  <SiderButton type="primary">Option 1</SiderButton>
                  <SiderButton type="primary">Option 2</SiderButton>
                  <SiderButton type="primary">Option 3</SiderButton>
                </SiderButton.Group>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-medium text-gray-700">
                  Icon Only Button Group
                </h3>
                <SiderButton.Group>
                  <SiderButton type="default" icon={<PlusIcon />} />
                  <SiderButton type="default" icon={<DownloadIcon />} />
                  <SiderButton type="default" icon={<SearchIcon />} />
                  <SiderButton type="default" icon={<SettingsIcon />} />
                </SiderButton.Group>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Custom Styling
          </h2>
          <div className="rounded-lg  p-6 shadow-sm">
            <div className="flex flex-wrap gap-4">
              <SiderButton
                type="primary"
                className="shadow-lg hover:shadow-xl"
                icon={<PlusIcon />}
              >
                Custom Shadow
              </SiderButton>
              <SiderButton
                type="default"
                classNames={{ icon: 'text-blue-500' }}
                icon={<HeartIcon />}
              >
                Custom Icon Color
              </SiderButton>
              <SiderButton
                type="primary"
                styles={{ icon: { transform: 'rotate(45deg)' } }}
                icon={<PlusIcon />}
              >
                Rotated Icon
              </SiderButton>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-text-primary-1 text-2xl font-semibold">
            Real World Examples
          </h2>
          <div className="space-y-6">
            <div className="rounded-lg  p-6 shadow-sm">
              <h3 className="text-text-primary-1 mb-4 text-lg font-medium">
                Form Actions
              </h3>
              <div className="flex justify-end gap-3">
                <SiderButton type="default">Cancel</SiderButton>
                <SiderButton type="primary" icon={<DownloadIcon />}>
                  Save
                </SiderButton>
              </div>
            </div>

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
                  <SiderButton type="default">Cancel</SiderButton>
                  <SiderButton
                    type="primary"
                    color="advanced"
                    icon={<TrashIcon />}
                  >
                    Delete
                  </SiderButton>
                </div>
              </div>
            </div>

            <div className="rounded-lg  p-6 shadow-sm">
              <h3 className="text-text-primary-1 mb-4 text-lg font-medium">
                Action Bar
              </h3>
              <div className="flex flex-wrap gap-2">
                <SiderButton size="small" type="primary" icon={<PlusIcon />}>
                  New
                </SiderButton>
                <SiderButton
                  size="small"
                  type="default"
                  icon={<DownloadIcon />}
                >
                  Export
                </SiderButton>
                <SiderButton size="small" type="default">
                  Filter
                </SiderButton>
                <SiderButton
                  size="small"
                  type="text"
                  color="advanced"
                  icon={<TrashIcon />}
                >
                  Delete Selected
                </SiderButton>
              </div>
            </div>

            <div className="rounded-lg  p-6 shadow-sm">
              <h3 className="text-text-primary-1 mb-4 text-lg font-medium">
                Toolbar with Button Group
              </h3>
              <div className="flex flex-wrap items-center gap-4">
                <SiderButton.Group>
                  <SiderButton type="default" icon={<PlusIcon />}>
                    Create
                  </SiderButton>
                  <SiderButton type="default" icon={<DownloadIcon />}>
                    Export
                  </SiderButton>
                </SiderButton.Group>
                <SiderButton type="text" icon={<SearchIcon />}>
                  Search
                </SiderButton>
                <SiderButton type="text" icon={<SettingsIcon />}>
                  Settings
                </SiderButton>
              </div>
            </div>

            <div className="rounded-lg  p-6 shadow-sm">
              <h3 className="text-text-primary-1 mb-4 text-lg font-medium">
                Pagination Style
              </h3>
              <div className="flex items-center justify-center gap-2">
                <SiderButton type="default" size="small">
                  Previous
                </SiderButton>
                <SiderButton.Group size="small">
                  <SiderButton type="primary">1</SiderButton>
                  <SiderButton type="default">2</SiderButton>
                  <SiderButton type="default">3</SiderButton>
                  <SiderButton type="default">4</SiderButton>
                  <SiderButton type="default">5</SiderButton>
                </SiderButton.Group>
                <SiderButton type="default" size="small">
                  Next
                </SiderButton>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default SiderButtonDemo
