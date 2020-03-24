function Events () {
  this._init()
}

Events.prototype._init = function () {
  this._events = Object.create(null)
}

Events.prototype.trigger = function (type, ...args) {
  const events = this._events, handler = events[type]
  if (!handler) return false
  if (typeof handler === 'function') {
    handler.apply(this, args)
  } else if (Array.isArray(handler)) {
    const listeners = handler.slice()
    for (let f of listeners) {
      f.apply(this, args)
    }
  }
}

Events.prototype.emit = Events.prototype.trigger

function _addListener (context, type, listener, prepend) {
  let events = context._events, existing = events[type]
  if (!existing) {
    events[type] = listener
  } else {
    if (typeof existing === 'function') {
      existing = events[type] = prepend ? [listener, existing] : [existing, listener]
    } else if (prepend) {
      existing.unshift(listener)
    } else {
      existing.push(listener)
    }
  }
  return context
}

Events.prototype.on = function (type, listener) {
  return _addListener(this, type, listener, false)
}

Events.prototype.prepend = function (type, listener) {
  return _addListener(this, type, listener, true)
}

Events.prototype.off = function (type, listener) {
  if (!arguments.length) return !this._init()

  const events = this._events

  if (typeof listener === undefined) {
    return delete events[type]
  }

  const target = events[type]

  if (!target) return false

  if (target === listener || target.listener === listener) {
    return delete events[type]
  }

  if (Array.isArray(target)) {
    const position = target.findIndex(
      _ => _ === listener || _.listener === listener
    )

    if (position < 0) return this

    if (target.length === 1) {
      return delete events[type]
    }

    if (position === 0) {
      target.shift()
    } else {
      spliceOne(target, position)
    }
    if (target.length === 1) {
      events[type] = target[0]
    }
  }
  return true
}


Events.prototype.once = function (type, listener) {
  this.on(type, _onceWrap(this, type, listener))
}

Events.prototype.prependOnce = function (type, listener) {
  this.prepend(type, _onceWrap(this, type, listener))
}

function _onceWrap (target, type, listener) {
  const state = { fired: false, wrapFn: undefined, target, type, listener }
  const wrapped = onceWrap.bind(state)
  wrapped.listener = listener
  state.wrapFn = wrapped
  return wrapped
}

function onceWrap (...args) {
  if (!this.fired) {
    this.target.off(this.type, this.wrapFn)
    this.fired = true
    return this.listener.apply(this.target, args)
  }
}

function spliceOne (arr, n) {
  for (let i=n, k=i+1; k<arr.length; i++, k++) {
    arr[i] = arr[k]
  }
  arr.length--
}

export default Events
