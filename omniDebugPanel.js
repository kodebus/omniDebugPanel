import { LightningElement, track } from 'lwc';
import { OmniscriptBaseMixin } from 'omnistudio/omniscriptBaseMixin';

export default class OmniDebugPanel extends OmniscriptBaseMixin(LightningElement) {

    @track isExpanded = false;
    @track copyLabel = 'Copy JSON';
    @track expandedObjects = {};

    // ─── Active step ──────────────────────────────────────────────────────────

    get currentStepName() {
        return this.omniScriptHeaderDef?.asName ?? null;
    }

    get currentStepLabel() {
        const name = this.currentStepName;
        const idx = this.omniScriptHeaderDef?.asIndex ?? '?';
        return name ? `${name} (index ${idx})` : 'Unknown';
    }

    // ─── Element extraction ───────────────────────────────────────────────────

    /**
     * The active step's data lives directly in omniJsonData[asName].
     * e.g. omniJsonData.LivedInStep = { CountryCode: "US", City: "New York", ... }
     *
     * labelMap tells us the full colon-separated path for each named element:
     * e.g. { "CountryCode": "LivedInStep:CountryCode", "Block1": "LivedInStep:Block1", ... }
     *
     * We build a flat list of every key in stepData and cross-reference labelMap
     * to get the expression path.
     */
    get stepElements() {
        const stepName = this.currentStepName;
        if (!stepName) return [];

        const jsonData   = this.omniJsonData ?? {};
        const stepData   = jsonData[stepName];
        const labelMap   = this.omniScriptHeaderDef?.labelMap ?? {};

        if (!stepData || typeof stepData !== 'object') return [];

        return Object.entries(stepData).filter(([, value]) => {
            return value !== null && value !== undefined && value !== '';
        }).map(([apiName, value]) => {
            const labelPath  = labelMap[apiName] ?? `${stepName}:${apiName}`;
            const dotPath    = labelPath.replace(/:/g, '.');
            const expression = `%${dotPath}%`;

            const isNull     = value === null || value === undefined || value === '';
            const isBool     = typeof value === 'boolean';
            const isObject   = !isNull && !isBool && typeof value === 'object';
            const isString   = !isNull && !isBool && !isObject;

            let displayValue = '';
            let objectSummary = '';
            if (isObject) {
                try {
                    displayValue = JSON.stringify(value, null, 2);
                    const keyCount = Object.keys(value).length;
                    objectSummary = `{ ${keyCount} ${keyCount === 1 ? 'key' : 'keys'} } — click to expand`;
                } catch(_) { displayValue = String(value); }
            } else if (isString) {
                displayValue = String(value);
            }

            return {
                apiName,
                label: apiName,
                expression,
                isNull,
                isBoolTrue:  isBool && value === true,
                isBoolFalse: isBool && value === false,
                isString,
                isObject,
                displayValue,
                objectSummary,
                isObjectExpanded: !!this.expandedObjects[apiName],
            };
        });
    }

    get hasElements() {
        return this.stepElements.length > 0;
    }

    // ─── JSON snapshot ────────────────────────────────────────────────────────

    get stepJsonData() {
        const stepName = this.currentStepName;
        if (!stepName) return '{}';
        try {
            const stepData = (this.omniJsonData ?? {})[stepName] ?? {};
            return JSON.stringify(stepData, null, 2);
        } catch(_) { return '{}'; }
    }

    get formattedJsonData() {
        try { return JSON.stringify(this.omniJsonData ?? {}, null, 2); }
        catch (_) { return '{}'; }
    }

    // ─── UI ───────────────────────────────────────────────────────────────────

    toggleExpanded() {
        this.isExpanded = !this.isExpanded;
        if (!this.isExpanded) {
            this.expandedObjects = {};
        }
    }

    get chevronIcon() { return this.isExpanded ? '▲' : '▼'; }

    toggleObject(event) {
        const apiName = event.currentTarget.dataset.apiname;
        this.expandedObjects = {
            ...this.expandedObjects,
            [apiName]: !this.expandedObjects[apiName]
        };
    }

    handleCopyJson(event) {
        event.stopPropagation();
        try {
            navigator.clipboard.writeText(this.stepJsonData).then(() => {
                this.copyLabel = 'Copied!';
                // eslint-disable-next-line @lwc/lwc/no-async-operation
                setTimeout(() => { this.copyLabel = 'Copy JSON'; }, 2000);
            });
        } catch(_) {}
    }
}
