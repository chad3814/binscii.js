'use strict';
/*jslint bitwise: true*/

var NO_MARKER = 0;
var NO_ALPHABET = 1;
var NO_FILE_DESCRIPTION = 2;
var IN_DATA = 3;

var toBin = function (x) {
    x = x.toString(2);
    while (x.length < 8) {
        x = '0' + x;
    }
    return x;
};

var decode = function (alphabet, data) {
    var a, b, b1, b1a, b2, b2a, c;
    a = ((alphabet[data[3]] & 0x3f) << 2) + ((0x30 & alphabet[data[2]]) >> 4);
    b1a = alphabet[data[2]] & 0x0f;
    b1 = (b1a << 4);
    b2a = 0x3c & alphabet[data[1]];
    b2 = (b2a >> 2);
    b = b1 + b2;
    c = (((alphabet[data[1]] & 0x03) << 6) & 0xff) + (0x3f & alphabet[data[0]]);
    return [a, b, c];
};

var encode = function (ralphabet, data) {
    var a, b, c, d;
    while (data.length < 3) {
        data.push(0);
    }
// 00111001 00111001 00010110 00010000
// 00stuvwx 00mnopqr 00ghijkl 00abcdef
//
// 01000001 01101110 01111001
// abcdefgh ijklmnop qrstuvwx
//    65       110     121
//    A         n       y
    a = data[2] & 0x3f;
    b = (data[1] & 0x0f) << 2;
    b += (data[2] & 0xc0) >> 6;
    c = (data[0] & 0x03) << 4;
    c += (data[1] & 0xf0) >> 4;
    d = (data[0] & 0xfc) >> 2;
    return ralphabet[a] + ralphabet[b] + ralphabet[c] + ralphabet[d];
};

var numToArray = function (x) {
    if (x < 0) {
        return [];
    }
    var arr = [];
    if (x === 0) {
        return [0];
    }
    while (x !== 0) {
        arr.unshift(x & 0xff);
        x >>= 8;
    }
    return arr;
};

exports.toBinSCII = function (filename, string) {
    var ralphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789()';
    var i;
    var line = 0;
    var out = 'FiLeStArTfIlEsTaRt\n';
    out += ralphabet + '\n';
    filename = filename.toUpperCase().slice(0, 16);
    out += ralphabet[filename.length] + filename;
    for (i = filename.length; i <= 16; i++) {
        out += ' ';
    }
    out += encode(ralphabet, numToArray(string.length));
    out += encode(ralphabet, numToArray(0));
    out += encode(ralphabet, [195, 6, 0]);
    out += encode(ralphabet, [0, 1, 1]);
    out += encode(ralphabet, [0, 75, 228]);
    out += encode(ralphabet, [18, 10, 75]);
    out += encode(ralphabet, [228, 18, 10]);
    out += encode(ralphabet, numToArray(string.length));
    out += encode(ralphabet, [38, 14, 0]);
//            struct binscii header {
//                byte filesize[3]; /* Total size of original file */
//                byte segstart[3]; /* Offset into original file of start of this seg */
//                byte acmode;      /* ProDOS file access mode */
//                byte filetype;    /* ProDOS file type */
//                byte auxtype[2];  /* ProDOS auxiliary file type */
//                byte storetype;   /* ProDOS file storage type */
//                byte blksize[2];  /* Number of 512-byte blocks in original file */
//                byte credate[2];  /* File creation date, in ProDOS 8 format */
//                byte cretime[2];  /* File creation time, in ProDOS 8 format */
//                byte moddate[2];  /* File modification date */
//                byte modtime[2];  /* File modification time */
//                byte seglen[3];   /* Length in bytes of this segment */
//                byte crc[2];      /* CRC checksum of preceding fields */
//                byte filler;      /* Unused filler byte */
//           };
    var data = string.split('').map(function (c) {
        return c.charCodeAt(0);
    });
    for (i = 0; i < data.length; i += 3) {
        if ((line % 16) === 0) {
            out += '\n';
        }
        line++;
        out += encode(ralphabet, data.slice(i, i + 3));
    }
    if (i !== data.length) {
        if ((line % 16) === 0) {
            out += '\n';
        }
        line++;
        out += encode(ralphabet, data.slice(i));
    }
    out += '\n';
    out += encode(ralphabet, [38, 14, 0]);
    out += '\n';
    return out;
};

exports.fromBinSCII = function (lines) {
    var alphabet = {};
    var filename = '';
    var metadata = {};
    var contents = [];
    var stage = NO_MARKER;
    var raw_data = [];
    var i;
    var buf;

    lines.forEach(function (line) {
        if (stage === NO_MARKER && line === 'FiLeStArTfIlEsTaRt') {
            stage = NO_ALPHABET;
            return;
        }
        if (stage === NO_ALPHABET) {
            for (i = 0; i < line.length; i++) {
                alphabet[line[i]] = i;
            }
            stage = NO_FILE_DESCRIPTION;
            return;
        }
        if (stage === NO_FILE_DESCRIPTION) {
            i = alphabet[line[0]]; // filename length
            filename = line.slice(1, i + 2);
            line = line.slice(i + 2).split(''); // description struct
            buf = decode(alphabet, line.slice(0, 4));
            metadata.filesize = (buf[2] << 16) + (buf[1] << 8) + buf[0];
            buf = decode(alphabet, line.slice(4, 8));
            metadata.segstart = (buf[2] << 16) + (buf[1] << 8) + buf[0];
            buf = decode(alphabet, line.slice(8, 12));
            metadata.acmode = buf[0];
            metadata.filetype = buf[1];
            metadata.auxtype = buf[2];
            buf = decode(alphabet, line.slice(12, 16));
            metadata.auxtype += buf[0] << 8;
            metadata.storetype = buf[1];
            metadata.blksize = buf[2];
            buf = decode(alphabet, line.slice(16, 20));
            metadata.blksize += buf[0] << 8;
            metadata.credate = [buf[1], buf[2]];
            buf = decode(alphabet, line.slice(20, 24));
            metadata.cretime = [buf[0], buf[1]];
            metadata.moddate = [buf[2]];
            buf = decode(alphabet, line.slice(24, 28));
            metadata.moddate[1] = buf[0];
            metadata.modtime = [buf[1], buf[2]];
            buf = decode(alphabet, line.slice(28, 32));
            metadata.seglen = (buf[2] << 16) + (buf[1] << 8) + buf[0];
            buf = decode(alphabet, line.slice(32, 36));
            metadata.crc = [buf[0], buf[1]];
            metadata.filler = buf[2];
            stage = IN_DATA;
            return;
        }
        if (stage !== IN_DATA) {
            // ignore line
            return;
        }

        raw_data = raw_data.concat(line.split('').filter(function (c) {
            return alphabet.hasOwnProperty(c);
        }));
    });
    for (i = 0; i < (raw_data.length - 4); i += 4) {
        contents = contents.concat(decode(alphabet, raw_data.slice(i, i + 4)));
    }
    return [filename, metadata, contents];
};


