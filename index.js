'use strict';

const SMHelper = {
    /**
     * From a dictionary, build the querystring part of a URL.
     * Resulting string can be appended to URLs after the `?` character.
     * 
     * Source: http://stackoverflow.com/a/1714899/192024
     * 
     * @param {object} obj - Dictionary with keys and values
     * @returns {string} The querystring that can be appended to URLs
     */
    buildQuerystring: (obj) => {
        let str = []
        for (let p in obj) {
            if (obj.hasOwnProperty(p)) {
                // Skip undefined
                if (typeof obj[p] === 'undefined') {
                    continue
                }

                // Special case: handle the integer 0
                if (obj[p] === 0) {
                    obj[p] = '0'
                }

                str.push(encodeURIComponent(p) + ((obj[p]) ? ('=' + encodeURIComponent(obj[p])) : ''))
            }
        }
        return str.join('&')
    },

    /**
     * Build a full HTTP/S URL from the various fragments.
     * 
     * @param {string} base - Base of the URL, including the protocol (e.g. `http://foo.bar/`)
     * @param {string|array} parts - Path, either as string or array (e.g. 'api/create' or ['api', 'create'])
     * @param {object} [args] - Dictionary with GET parameters
     * @returns {string} The full URL
     */
    buildUrl: (base, parts, args) => {
        base = base || ''
        parts = parts || []

        if (typeof parts === 'string') {
            parts = parts.split('/')
        }

        let append = parts.map(encodeURIComponent).join('/')

        if (args) {
            append += '?' + SMHelper.buildQuerystring(args)
        }

        if (base.length > 1 && base.slice(-1) != '/') {
            base += '/'
        }

        return base + append
    },

    /**
     * Clone a JS object, deeply.
     * 
     * @param {*} obj - The object to clone (any scalar or non-scalar type)
     * @returns {*} The cloned object
     */
    cloneObject: (obj) => {
        // Return 'obj' itself if it's a scalar type or 'undefined'
        if (obj === undefined || SMHelper.isScalar(obj)) {
            return obj
        }
        // According to http://jsperf.com/cloning-an-object/13 this is the fastest way
        return JSON.parse(JSON.stringify(obj))
    },

    /**
     * Remove all empty properties from an object.
     * If "onlyNull", remove all `null` value only.
     * The object, which is passed by reference, is modified.
     * 
     * @param {object} obj - Object to compact
     * @param {boolean} [onlyNull=false] - If true, remove only values that are strictly `null`
     */
    compactObject: (obj, onlyNull) => {
        let recursive = (obj) => {
            for (let key in obj) {
                // Exclude non-own properties
                if (!obj.hasOwnProperty(key)) {
                    continue
                }

                if (obj[key] === null || (!onlyNull && !obj[key])) {
                    delete obj[key]
                }
                else if (typeof obj[key] === 'object') {
                    recursive(obj[key])

                    if (!Object.keys(obj[key]).length) {
                        // Delete empty objects
                        delete obj[key]
                    }
                }
            }
        }
        recursive(obj)
    },

    /**
     * Get a nested property from a dictionary or array, referenced by a string in "dot notation".
     * For example: "key1.key2.0"
     * 
     * Source: http://stackoverflow.com/a/8052100/192024
     * 
     * @param {object} obj - Object containing the property
     * @param {string} desc - Name of the nested property 
     * @returns {*} Value of the referenced property or `undefined`
     */
    getDescendantProperty: (obj, desc) => {
        let arr = desc.split('.')
        while (arr.length && (obj = obj[arr.shift()])); // Leave the ; here!
        return obj
    },

    /**
     * Check if a value is numeric.
     * 
     * Sources: jQuery
     * https://github.com/jquery/jquery/blob/6acf4a79467a5aea5bc1eb7d552d72366718635d/src/core.js#L224
     * https://github.com/jquery/jquery/blob/6acf4a79467a5aea5bc1eb7d552d72366718635d/src/core.js#L271
     * Copyright (c) jQuery Foundation and other contributors
     * License: https://github.com/jquery/jquery/blob/master/LICENSE.txt
     * 
     * @param {*} obj - Value to analyze
     * @returns {boolean} True if value is numeric 
     */
    isNumeric: (obj) => {
        let type
        if (obj == null) {
            type = obj + ""
        }
        else {
            type = typeof obj === "object" || typeof obj === "function" ?
                "object" : typeof obj
        }

        return (type === "number" || type === "string") &&
            // parseFloat NaNs numeric-cast false positives ("")
            // ...but misinterprets leading-number strings, particularly hex literals ("0x...")
            // subtraction forces infinities to NaN
            !isNaN(obj - parseFloat(obj))
    },

    /**
     * Check if a value is a plain object.
     * 
     * Source: http://stackoverflow.com/a/38555871/192024
     * 
     * @param {*} obj - Value to analyze
     * @returns {boolean} True if value is a plain object
     */
    isPlainObject: (obj) => {
        return	typeof obj === 'object'
            && obj !== null
            && obj.constructor === Object
            && Object.prototype.toString.call(obj) === '[object Object]'
    },

    /**
     * Check if a value is of a scalar type (string, number, boolean).
     * 
     * Source: http://www.jsoneliners.com/function/is-scalar/
     * 
     * @param {*} obj - Value to analyze
     * @returns {boolean} True if value is of a scalar type
     */
    isScalar: (obj) => {
        return (/string|number|boolean/).test(typeof obj)
    },

    /**
     * Flatten a dictionary to the "dot notation", as used by MongoDB.
     * If preserveArrays is true, arrays are not transformed to the "dot notation".
     * 
     * Adapted from http://stackoverflow.com/questions/13218745/convert-complex-json-object-to-dot-notation-json-object
     * 
     * @param {object} obj - Dictionary to convert
     * @param {boolean} [preserveArrays=false] - If true, arrays are not transformed to the "dot notation"
     * @returns {object} Flattened dictionary in "dot notation"
     */
    objectToDotNotation: (obj, preserveArrays) => {
        let res = {}

        let recursive = (obj, current) => {
            for (let key in obj) {
                let value = obj[key]
                let newKey = (current ? current + '.' + key : key)
                if (value && typeof value === 'object') {
                    if (preserveArrays && Array.isArray(value)) {
                        res[newKey] = value
                    }
                    else {
                        recursive(value, newKey)
                    }
                }
                else {
                    res[newKey] = value
                }
            }
        }
        recursive(obj)

        return res
    },

    /**
     * Take `str` and puts a backslash in front of every character that is part of the regular expression syntax.
     * Port of the PHP function "preg_quote". See also: http://php.net/preg_quote
     * 
     * Source: Locutus
     * https://github.com/kvz/locutus/blob/9aea421087656a4cf42decf9b032f28b145f0fdb/src/php/pcre/preg_quote.js
     * Copyright (c) 2007-2016 Kevin van Zonneveld
     * License: https://github.com/kvz/locutus/blob/9aea421087656a4cf42decf9b032f28b145f0fdb/LICENSE
     * 
     * @param {string} str - String to escape
     * @param {string} [delimiter] - If the optional delimiter is specified, it will also be escaped. This is useful for escaping the delimiter that is required by the regular expressions. The / is the most commonly used delimiter. 
     * @returns {string} Quoted (escaped) string
     */
    pregQuote: (str, delimiter) => {
        //  discuss at: http://locutus.io/php/preg_quote/
        // original by: booeyOH
        // improved by: Ates Goral (http://magnetiq.com)
        // improved by: Kevin van Zonneveld (http://kvz.io)
        // improved by: Brett Zamir (http://brett-zamir.me)
        // bugfixed by: Onno Marsman (https://twitter.com/onnomarsman)
        //   example 1: preg_quote("$40")
        //   returns 1: '\\$40'
        //   example 2: preg_quote("*RRRING* Hello?")
        //   returns 2: '\\*RRRING\\* Hello\\?'
        //   example 3: preg_quote("\\.+*?[^]$(){}=!<>|:")
        //   returns 3: '\\\\\\.\\+\\*\\?\\[\\^\\]\\$\\(\\)\\{\\}\\=\\!\\<\\>\\|\\:'

        return (str + '')
            .replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' + (delimiter || '') + '-]', 'g'), '\\$&')
    },

    /**
     * Determine if a given string matches a pattern, allowing * as wildcard.
     * Ported from PHP, originally in Laravel 5.3 Str::is - See: https://github.com/laravel/framework/blob/v5.3.10/src/Illuminate/Support/Str.php#L119
     * 
     * Original copyright: Laravel
     * Copyright (c) Taylor Otwell
     * License: https://github.com/laravel/framework/blob/v5.3.10/LICENSE.md
     * 
     * @param {string} pattern - Pattern to search in value
     * @param {string} value - String in which the pattern is searched
     * @returns {boolean} True if value matches pattern
     */
    strIs: (pattern, value) => {
        if (pattern == value) return true
        if (pattern == '*') return true

        pattern = module.exports.pregQuote(pattern, '/')

        // Asterisks are translated into zero-or-more regular expression wildcards
        // to make it convenient to check if the strings starts with the given
        // pattern such as "library/*", making any string check convenient.
        let regex = new RegExp('^' + pattern.replace(/\\\*/g, '.*') + '$')

        return !!value.match(regex)
    },

    /**
     * Convert strings with dashes or underscores (eg. 'foo-bar' or 'foo_bar') to camelCase ('fooBar')
     * 
     * Adapted from: http://jamesroberts.name/blog/2010/02/22/string-functions-for-javascript-trim-to-camel-case-to-dashed-and-to-underscore/comment-page-1/
     * 
     * @param {string} str - Dashed string
     * @returns {string} String converted to camelCase
     */ 
    stringToCamel: (str) => {
        return str.replace(/(\-[a-z0-9]|_[a-z0-9])/g, ($1) => {
            return $1.toUpperCase().replace(/\-|_/g, '')
        })
    },

    /**
     * Strip HTML tags, except allowed ones.
     * This function is a port of the PHP strip_tags function: http://php.net/strip_tags
     * 
     * Source: Locutus
     * https://github.com/kvz/locutus/blob/9aea421087656a4cf42decf9b032f28b145f0fdb/src/php/strings/strip_tags.js
     * Copyright (c) 2007-2016 Kevin van Zonneveld
     * License: https://github.com/kvz/locutus/blob/9aea421087656a4cf42decf9b032f28b145f0fdb/LICENSE
     * 
     * @param {string} input - Input string
     * @param {string} [allowed] - String listing allowed HTML tags, for example `<br>`
     * @returns {string} String with HTML tags stripped
     */
	stripTags: (input, allowed) => {
        //  discuss at: http://locutus.io/php/strip_tags/
        // original by: Kevin van Zonneveld (http://kvz.io)
        // improved by: Luke Godfrey
        // improved by: Kevin van Zonneveld (http://kvz.io)
        //    input by: Pul
        //    input by: Alex
        //    input by: Marc Palau
        //    input by: Brett Zamir (http://brett-zamir.me)
        //    input by: Bobby Drake
        //    input by: Evertjan Garretsen
        // bugfixed by: Kevin van Zonneveld (http://kvz.io)
        // bugfixed by: Onno Marsman (https://twitter.com/onnomarsman)
        // bugfixed by: Kevin van Zonneveld (http://kvz.io)
        // bugfixed by: Kevin van Zonneveld (http://kvz.io)
        // bugfixed by: Eric Nagel
        // bugfixed by: Kevin van Zonneveld (http://kvz.io)
        // bugfixed by: Tomasz Wesolowski
        //  revised by: Rafał Kukawski (http://blog.kukawski.pl)
        //   example 1: strip_tags('<p>Kevin</p> <br /><b>van</b> <i>Zonneveld</i>', '<i><b>')
        //   returns 1: 'Kevin <b>van</b> <i>Zonneveld</i>'
        //   example 2: strip_tags('<p>Kevin <img src="someimage.png" onmouseover="someFunction()">van <i>Zonneveld</i></p>', '<p>')
        //   returns 2: '<p>Kevin van Zonneveld</p>'
        //   example 3: strip_tags("<a href='http://kvz.io'>Kevin van Zonneveld</a>", "<a>")
        //   returns 3: "<a href='http://kvz.io'>Kevin van Zonneveld</a>"
        //   example 4: strip_tags('1 < 5 5 > 1')
        //   returns 4: '1 < 5 5 > 1'
        //   example 5: strip_tags('1 <br/> 1')
        //   returns 5: '1  1'
        //   example 6: strip_tags('1 <br/> 1', '<br>')
        //   returns 6: '1 <br/> 1'
        //   example 7: strip_tags('1 <br/> 1', '<br><br/>')
        //   returns 7: '1 <br/> 1'

        // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)
        allowed = (((allowed || '') + '').toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join('')

        let tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi
        let commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi

        return input.replace(commentsAndPhpTags, '').replace(tags, ($0, $1) => {
            return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : ''
        })
	},

    /**
     * Convert a value to string, ensuring that the number 0 and the boolean false are treated correctly
     * 
     * @param {*} val - Value to convert
     * @returns {string} String value
     */
    toStringSafe: (val) => {
        // Ensure str is a string
        if(typeof val == 'number' && !isNaN(val)) {
            // Numbers have a special treatment to avoid having 0 converted to null
            val = val.toString()
        }
        else if(val === false) {
            val = 'false'
        }
        else {
            val = val ? val + '' : ''
        }

        return val
    },

    /**
     * Update a property (represented in the "dot notation") in an object.
     * The object is modified.
     * 
     * @param {object} obj - Object to the be updated
     * @param {string} property - Name of the property to update, in "dot notation"
     * @param {*} value - New value for the matched property
     */
    updatePropertyInObject: (obj, property, value) => {
        // Explode the dot notation
        let parts = property.split('.')
        let last = parts.pop()

        // Get the destination object
        let dest = obj
        for (let i = 0; i < parts.length; i++) {
            if (!dest[parts[i]]) {
                dest[parts[i]] = {}
            }
            dest = dest[parts[i]]
        }

        // Update the value
        dest[last] = value
    }
}

module.exports = SMHelper
