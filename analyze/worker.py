
from json import dumps as D, loads as L
import numpy as np
import sys

### Processing steps ###

def _prepare_batches(data):
    # Smoothes data and separates into 200-batches.
    k = np.arange(-1, 1, 1)
    y = np.exp(-k ** 2 / 2) / np.sqrt(2 * np.pi)
    y = y / sum(y)

    convolved_data = np.convolve(data, y, 'valid')
    center = sum(convolved_data) / len(convolved_data)
    convolved_data = convolved_data - center

    kh = int(len(convolved_data) / 200) + 1
    padded = np.pad(
        convolved_data,
        (0, (kh * 200) - len(convolved_data)),
        'constant',
        constant_values = (0,0)
    )
    batches = padded.reshape((kh, 200))

    return batches

def _find_peak_one_row(row):
    # Finds peaks of row.
    result = []
    d = np.diff(row)
    for i in range(5, len(d) - 1):
        if d[i] > 0 and d[i + 1] < 0:
            result.append(i)
    return result

def _find_peaks(batches):
    # Autocorrelate data and find peaks.
    def corrify(row):
        # Autocorrelates row.
        corred = np.correlate(row, row, 'same')
        return corred / max(corred)

    kh = len(batches)
    corrs = np.ndarray((kh, 100))
    for i in range(kh):
        corrs[i] = corrify(batches[i])[100:]

    freqs = [x[0] for x in [
        _find_peak_one_row(row) for row in corrs
    ] if len(x) > 0]

    return freqs

def _find_amps(batches):
    amps = []
    for row in batches:
        tops = [row[i] for i in _find_peak_one_row(row)]
        avg = sum(tops) / len(tops)
        amps.append(avg)

    return amps

def _process_data_one_dimension(data):
    # Packages one dimension of data.
    batches = _prepare_batches(data)
    return {
        'frequencies': _find_peaks(batches),
        'amplitudes': _find_amps(batches)
    }

### Serverless endpoints ###

def _analyze(raw):
    segs = raw.split('/')
    data = []
    for i in range(1, len(segs) - 1):
        nums = [float(x) for x in segs[i].split('+')]
        data.append((nums[0], nums[1], nums[2]))

    # Then we can perform the necessary operations.
    xs = [n[0] for n in data]
    ys = [n[1] for n in data]
    zs = [n[2] for n in data]

    return {
        'x': _process_data_one_dimension(xs),
        'y': _process_data_one_dimension(ys),
        'z': _process_data_one_dimension(zs)
    }

# Mimics the lambda API

def _construct_response(status, body):
    return {
        'statusCode': str(status),
        'headers': {
            'Content-Type': 'application/json'
        },
        'isBase64Encoded': False,
        'body': D(body)
    }

def handler(data):
    status, result = 200, {
        'type': 'process_result',
        'data': _analyze(data)
    }

    return _construct_response(status, result)

result = handler(sys.argv[1])
print(result)
sys.stdout.flush()
