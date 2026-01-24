class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this._buffer = new Float32Array(this.bufferSize);
        this._index = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        // Note: input is array of channels. input[0] is first channel.
        if (!input || !input.length) return true;

        const channel0 = input[0];

        for (let i = 0; i < channel0.length; i++) {
            this._buffer[this._index++] = channel0[i];

            if (this._index >= this.bufferSize) {
                // Send full buffer
                this.port.postMessage(this._buffer);
                this._index = 0; // Reset
            }
        }

        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);
