import { Counter, Gauge, Histogram, LabelValues, register, Registry, Summary } from "prom-client";

interface MetricInstances {
    type: string;
    instance: Counter | Gauge | Histogram | Summary;
}

export class Metrics {
    private registry: Registry;
    private instances: Map<string, MetricInstances>;

    constructor() {
        this.registry = new Registry();
        this.instances = new Map<string, MetricInstances>();
    }

    public create(type: string, name: string, help: string) {
        let instance: Counter | Gauge | Histogram | Summary;
        if (type === "counter") {
            instance = new Counter({ name, help });
            this.registry.registerMetric(instance);
            this.instances.set(name, { type, instance });
        } else if (type === "gauge") {
            instance = new Gauge({ name, help });
            this.registry.registerMetric(instance);
            this.instances.set(name, { type, instance });
        } else if (type === "histogram") {
            instance = new Histogram({ name, help });
            this.registry.registerMetric(instance);
            this.instances.set(name, { type, instance });
        } else if (type === "summary") {
            instance = new Summary({ name, help });
            this.registry.registerMetric(instance);
            this.instances.set(name, { type, instance });
        }
    }

    public add(name: string, data: number) {
        const item = this.instances.get(name);
        if (item !== undefined) {
            if (item.type === "counter") {
                (item.instance as Counter).inc(data);
            } else if (item.type === "gauge") {
                (item.instance as Gauge).set(data);
            } else if (item.type === "histogram") {
                (item.instance as Histogram).observe(data);
            } else if (item.type === "summary") {
                (item.instance as Summary).observe(data);
            }
        }
    }

    public gaugeSet(name: string, label: any, data: number) {
        const item = this.instances.get(name);
        if (item !== undefined) {
            if (item.type === "gauge") {
                (item.instance as Gauge).labels(label).set(data);
            }
        }
    }

    public gaugeLabels(name: string, label: any, data: number) {
        const item = this.instances.get(name);
        if (item !== undefined) {
            if (item.type === "gauge") {
                (item.instance as Gauge).labels(label).set(data);
            }
        }
    }

    public async metrics() {
        return this.registry.metrics();
    }

    public contentType() {
        return this.registry.contentType;
    }

    public createGauge(name: string, help: string, labelNames: string[]) {
        const type: string = "gauge";
        const instance = new Gauge({ name, help, labelNames });
        this.registry.registerMetric(instance);
        this.instances.set(name, { type, instance });
    }
}
