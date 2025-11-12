import { baseURL } from '@/baseUrl'
import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'

const getAppsSdkCompatibleHtml = async (baseUrl: string, path: string) => {
  const result = await fetch(`${baseUrl}${path}`)
  return await result.text()
}

type ContentWidget = {
  id: string
  title: string
  templateUri: string
  invoking: string
  invoked: string
  html: string
  description: string
  widgetDomain: string
}

function widgetMeta(widget: ContentWidget) {
  return {
    'openai/outputTemplate': widget.templateUri,
    'openai/toolInvocation/invoking': widget.invoking,
    'openai/toolInvocation/invoked': widget.invoked,
    'openai/widgetAccessible': false,
    'openai/resultCanProduceWidget': true,
  } as const
}

const handler = createMcpHandler(async (server) => {
  const html = await getAppsSdkCompatibleHtml(baseURL, '/')

  const contentWidget: ContentWidget = {
    id: 'pdf_translator',
    title: 'pdf Translator',
    templateUri: 'ui://widget/content-template.html',
    invoking: 'Loading content...',
    invoked: 'Content loaded',
    html: html,
    description:
      'When uploading and translating PDFs, I will display the PDF translation app',
    widgetDomain: 'https://nextjs.org/docs',
  }
  server.registerResource(
    'content-widget',
    contentWidget.templateUri,
    {
      title: contentWidget.title,
      description: contentWidget.description,
      mimeType: 'text/html+skybridge',
      _meta: {
        'openai/widgetDescription': contentWidget.description,
        'openai/widgetPrefersBorder': true,
      },
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/html+skybridge',
          text: `${contentWidget.html}`,
          _meta: {
            'openai/widgetDescription': contentWidget.description,
            'openai/widgetPrefersBorder': true,
            'openai/widgetDomain': contentWidget.widgetDomain,
          },
        },
      ],
    }),
  )

  server.registerTool(
    contentWidget.id,
    {
      title: contentWidget.title,
      description: contentWidget.description,
      _meta: widgetMeta(contentWidget),
    },
    async () => {
      return {
        content: [
          {
            type: 'text',
            text: 'Document translation tool',
          },
        ],
        structuredContent: {
          timestamp: new Date().toISOString(),
        },
        _meta: widgetMeta(contentWidget),
      }
    },
  )

  server.registerTool(
    'fetch',
    {
      title: 'App Fetch',
      description: 'Internal APP fetch tool for accessing internal APIs',
      inputSchema: {
        id: z
          .string()
          .describe('Unique identifier for the authentication token'),
        method: z
          .enum(['GET', 'POST', 'PUT', 'DELETE'])
          .optional()
          .describe('HTTP method (defaults to configured method for endpoint)'),
        payload: z
          .any()
          .optional()
          .describe('Request payload (for POST/PUT requests)'),
        queryParams: z
          .record(z.string())
          .optional()
          .describe('Query parameters for the request'),
        headers: z
          .record(z.string())
          .optional()
          .describe('Additional request headers'),
      },
      _meta: {
        'openai/readOnlyHint':
          'This tool is for internal application use only and not available in the ChatGPT interface',
        'openai/internalOnly': true,
      },
    },
    async ({ id, method, payload, queryParams, headers }) => {
      try {
        const baseUrl = 'https://dev.wisebox.ai'

        const searchParams = new URLSearchParams({ ...queryParams })
        const url = new URL(id, baseUrl)
        url.search = searchParams.toString()

        const requestHeaders = new Headers({
          'Content-Type': 'application/json',
          ...headers,
        })

        const requestMethod = method || 'GET'

        const body = ['POST', 'PUT'].includes(requestMethod)
          ? JSON.stringify(payload)
          : undefined

        console.log(url.toString(), 'url.toString()')
        console.log(
          JSON.stringify({
            method: requestMethod,
            headers: requestHeaders,
            body,
          }),
        )

        const response = await fetch(url.toString(), {
          method: requestMethod,
          headers: requestHeaders,
          body,
        })

        let responseData
        const contentType = response.headers.get('Content-Type') || ''

        if (contentType.includes('application/json')) {
          responseData = await response.json()
        } else if (contentType.includes('text/plain')) {
          responseData = await response.text()
        } else {
          responseData = await response.text()
        }

        return {
          content: [
            {
              type: 'text',
              text: `Successfully fetched data from the API ${id}`,
            },
          ],
          structuredContent: {
            response: responseData,
            timestamp: new Date().toISOString(),
          },
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error fetching data from the API ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        }
      }
    },
  )
})

export const GET = handler
export const POST = handler
