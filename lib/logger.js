const colors = [
  '#d35eeb',
  '#1385FF',
  '#f3c35c',
  '#ee4949'
]

const methods = [
  'debug',
  'info',
  'warn',
  'error'
]

const cs = color => `color: #010101; background: ${color}; padding: 2px 4px; font-size: 12px; border-radius: 4px;`

const consoleLog = (text, data, type, color) => {
  const now = new Date().toLocaleString()

  if (typeof text == 'object') {
    text = ''
    data = text
  }

  console.log(`%c${now} [${type}] - ${ text }${ data ? ' --> %o' : ''}`, cs(color), data ? data : '')
}

function Logger () {}


for (let i=0; i<methods.length; i++) {
  Logger[methods[i]] = (text, data) => consoleLog(text, data, methods[i], colors[i])
}

export default Logger
