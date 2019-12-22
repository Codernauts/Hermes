import { ws } from './ws'
import { addMessage } from 'ts/utils/message'
import { isAtBottom, scrollToBottom } from 'ts/utils/ui'

(window as any).ws = ws // TODO!: REMOVE

ws.onMessage(message => {
  switch (message.header) {
    case 'RESPONSE': {
      break
    } case 'NEW_MESSAGE': {
      const scroll = isAtBottom()

      addMessage(message.data)

      if (scroll) {
        scrollToBottom()
      }
      break
    } default: {
      console.log('Unimplemented:', message)
    }
  }
})