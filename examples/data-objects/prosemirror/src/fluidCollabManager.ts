/*!
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { strict as assert } from "assert";
import { EventEmitter } from "events";
import { ILoader } from "@fluidframework/container-definitions";
import {
    createGroupOp,
    createRemoveRangeOp,
    Marker,
    ReferenceType,
    TextSegment,
    IMergeTreeDeltaOp,
} from "@fluidframework/merge-tree";
import { SharedString } from "@fluidframework/sequence";
import { buildMenuItems, exampleSetup } from "prosemirror-example-setup";
import { MenuItem } from "prosemirror-menu";
import { DOMSerializer, Fragment, NodeSpec, Schema, Slice } from "prosemirror-model";
import { addListNodes } from "prosemirror-schema-list";
import { EditorState, NodeSelection, Plugin, Transaction } from "prosemirror-state";
import { insertPoint } from "prosemirror-transform";
import { EditorView } from "prosemirror-view";
import { ComponentView } from "./componentView";
import { IProseMirrorNode, nodeTypeKey, ProseMirrorTransactionBuilder, sliceToGroupOps } from "./fluidBridge";
import { schema } from "./fluidSchema";
import { FootnoteView } from "./footnoteView";
import { openPrompt, TextField } from "./prompt";
import { create as createSelection } from "./selection";

// eslint-disable-next-line @typescript-eslint/no-require-imports
import OrderedMap = require("orderedmap");

declare module "@fluidframework/core-interfaces" {
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    export interface IFluidObject extends Readonly<Partial<IProvideRichTextEditor>> { }
}

export const IRichTextEditor: keyof IProvideRichTextEditor = "IRichTextEditor";

export interface IProvideRichTextEditor {
    readonly IRichTextEditor: IRichTextEditor;
}

export interface IRichTextEditor extends IProvideRichTextEditor {
    getValue(): string;

    initializeValue(value: any): void;

    getSchema(): any;

    getCurrentState(): any;
}

export class FluidCollabManager extends EventEmitter implements IRichTextEditor {
    public get IRichTextEditor() { return this; }

    public readonly plugin: Plugin;
    private readonly schema: Schema;
    private state: EditorState;
    private editorView: EditorView;
    private tooltip: HTMLDivElement;

    constructor(private readonly text: SharedString, private readonly loader: ILoader) {
        super();

        this.plugin = new Plugin({
            state: {
                init: () => null,
                apply: (tr) => {
                    this.applyTransaction(tr);
                    return null;
                },
            },
            view : (editorView) => {
                this.tooltip = document.createElement("div")
                this.tooltip.className = "tooltip"
                editorView.dom.parentNode.appendChild(this.tooltip)
                this.updateSelection(editorView, null);

                return {
                    update: (editorView: EditorView, prevState: EditorState) => {this.updateSelection(editorView, prevState)},
                    destroy: () => {this.destroySelection()}
                }
            }
        });


        const fluidSchema = new Schema({
            nodes: addListNodes(schema.spec.nodes as OrderedMap<NodeSpec>, "paragraph block*", "block"),
            marks: schema.spec.marks,
        });
        this.schema = fluidSchema;

        // Initialize the base ProseMirror JSON data structure
        const nodeStack = new Array<IProseMirrorNode>();
        nodeStack.push({ type: "doc", content: [] });

        this.text.walkSegments((segment) => {
            const top = nodeStack[nodeStack.length - 1];
            if (TextSegment.is(segment)) {
                const nodeJson: IProseMirrorNode = {
                    type: "text",
                    text: segment.text,
                };

                if (segment.properties) {
                    nodeJson.marks = [];
                    for (const propertyKey of Object.keys(segment.properties)) {
                        nodeJson.marks.push({
                            type: propertyKey,
                            value: segment.properties[propertyKey],
                        });
                    }
                }

                top.content.push(nodeJson);
            } else if (Marker.is(segment)) {
                // TODO are marks applied to the structural nodes as well? Or just inner text?

                const nodeType = segment.properties[nodeTypeKey];
                switch (segment.refType) {
                    case ReferenceType.NestBegin:
                        // Create the new node, add it to the top's content, and push it on the stack
                        const newNode = { type: nodeType, content: [] };
                        top.content.push(newNode);
                        nodeStack.push(newNode);
                        break;

                    case ReferenceType.NestEnd:
                        const popped = nodeStack.pop();
                        assert(popped.type === nodeType);
                        break;

                    case ReferenceType.Simple:
                        // TODO consolidate the text segment and simple references
                        const nodeJson: IProseMirrorNode = {
                            type: segment.properties.type,
                            attrs: segment.properties.attrs,
                        };

                        if (segment.properties) {
                            nodeJson.marks = [];
                            for (const propertyKey of Object.keys(segment.properties)) {
                                if (propertyKey !== "type" && propertyKey !== "attrs") {
                                    nodeJson.marks.push({
                                        type: propertyKey,
                                        value: segment.properties[propertyKey],
                                    });
                                }
                            }
                        }

                        top.content.push(nodeJson);
                        break;

                    default:
                        // Throw for now when encountering something unknown
                        throw new Error("Unknown marker");
                }
            }

            return true;
        });

        const menu = buildMenuItems(this.schema);
        menu.insertMenu.content.push(new MenuItem({
            title: "Insert Component",
            label: "Component",
            enable: (state) => true,
            run: (state, _, view) => {
                const { from, to } = state.selection;
                let nodeAttrs = null;
                if (state.selection instanceof NodeSelection && state.selection.node.type === fluidSchema.nodes.fluid) {
                    nodeAttrs = state.selection.node.attrs;
                }
                openPrompt({
                    title: "Insert component",
                    fields: {
                        src: new TextField({ label: "Url", required: true, value: nodeAttrs && nodeAttrs.src }),
                        title: new TextField({ label: "Title", value: nodeAttrs && nodeAttrs.title }),
                        alt: new TextField({
                            label: "Description",
                            value: nodeAttrs ? nodeAttrs.alt : state.doc.textBetween(from, to, " "),
                        }),
                    },
                    callback(attrs) {
                        view.dispatch(view.state.tr.replaceSelectionWith(fluidSchema.nodes.fluid.createAndFill(attrs)));
                        view.focus();
                    },
                });
            },
        }));

        menu.insertMenu.content.push(new MenuItem({
            title: "Insert footnote",
            label: "Footnote",
            select: (state) => insertPoint(state.doc, state.selection.from, fluidSchema.nodes.footnote) != null,
            run(state, dispatch) {
                const { empty, $from, $to } = state.selection;
                let content = Fragment.empty;
                if (!empty && $from.sameParent($to) && $from.parent.inlineContent) {
                    content = $from.parent.content.cut($from.parentOffset, $to.parentOffset);
                }
                dispatch(state.tr.replaceSelectionWith(fluidSchema.nodes.footnote.create(null, content)));
            },
        }));

        const doc = nodeStack.pop();
        console.log(JSON.stringify(doc, null, 2));

        const fluidDoc = this.schema.nodeFromJSON(doc);
        this.state = EditorState.create({
            doc: fluidDoc,
            plugins:
                exampleSetup({
                    schema: this.schema,
                    menuContent: menu.fullMenu,
                })
                    .concat(this.plugin)
                    .concat(createSelection()),
        });

        let sliceBuilder: ProseMirrorTransactionBuilder;

        this.text.on(
            "pre-op",
            (op, local) => {
                if (local) {
                    return;
                }

                const startState = this.getCurrentState();
                sliceBuilder = new ProseMirrorTransactionBuilder(
                    startState,
                    this.schema,
                    this.text);
            });

        this.text.on(
            "sequenceDelta",
            (ev) => {
                if (ev.isLocal) {
                    return;
                }

                sliceBuilder.addSequencedDelta(ev);
            });

        this.text.on(
            "op",
            (op, local) => {
                this.emit("valueChanged", op);

                if (local) {
                    return;
                }

                const tr = sliceBuilder.build();
                this.apply(tr);
            });
    }

    public getSchema() {
        return this.schema;
    }

    public getValue(): string {
        const currentState = this.getCurrentState();

        const fragment = DOMSerializer
            .fromSchema(this.schema)
            .serializeFragment(currentState.doc.content);
        const wrapper = document.createElement("div");
        wrapper.appendChild(fragment);
        return wrapper.innerHTML;
    }

    public initializeValue(value: any): void {
        const state = this.getCurrentState();
        const tr = state.tr;
        // const node = this.schema.nodeFromJSON(
        //     {
        //         type: "paragraph",
        //         content: [
        //             {
        //                 type: "text",
        //                 text: value,
        //             },
        //         ],
        //     });

        const node = value;

        tr.replaceRange(0, state.doc.content.size, new Slice(node.content, 0, 0));

        this.apply(tr);
    }

    public updateSelection(view: EditorView, lastState: EditorState) {
        let state = view.state
        // Don't do anything if the document/selection didn't change
        if (lastState && lastState.doc.eq(state.doc) && lastState.selection.eq(state.selection))
            return

        // Hide the tooltip if the selection is empty
        if (state.selection.empty) {
            this.tooltip.style.display = "none"
            return
        }
        let {from, to} = state.selection

        const proseMirrorNode = state.doc.cut(from, to).firstChild?.content.size > 0 ? state.doc.cut(from, to).firstChild : state.doc.cut(from, to).lastChild;

        const textContent = proseMirrorNode.content.firstChild?.text?.toString();

        this.emit("selection", {textContent, cb: (content: Array<any>) => {this.updateTooltipContent(content, view, from, to)}})
    }

    public updateTooltipContent(content: Array<any>, view: EditorView, from: number, to: number) {
        this.tooltip.style.display = ""
        // These are in screen coordinates
        let start = view.coordsAtPos(from), end = view.coordsAtPos(to)
        // The box in which the tooltip is positioned, to use as base
        let box = this.tooltip.offsetParent.getBoundingClientRect()
        // Find a center-ish x position from the selection endpoints (when
        // crossing lines, end may be more to the left)
        let left = Math.max((start.left + end.left) / 2, start.left + 3)
        this.tooltip.style.left = (left - box.left) + "px"
        this.tooltip.style.bottom = (box.bottom - start.top) + "px"

        let tooltipContent: string = ``;
        content.forEach(element => {
            tooltipContent += `<div><b>${element.heading}</b> : ${element.data}</div>`;
        });

        this.tooltip.innerHTML = tooltipContent;
    }

    public destroySelection() { this.tooltip.remove(); }

    public setupEditor(textArea: HTMLDivElement) {
        /* eslint-disable @typescript-eslint/no-require-imports,
        import/no-internal-modules, import/no-unassigned-import */
        require("prosemirror-view/style/prosemirror.css");
        require("prosemirror-menu/style/menu.css");
        require("prosemirror-example-setup/style/style.css");
        require("./style.css");
        /* eslint-enable @typescript-eslint/no-require-imports,
        import/no-internal-modules, import/no-unassigned-import */

        const editorView = new EditorView(
            textArea,
            {
                state: this.state,
                nodeViews: {
                    fluid: (node, view, getPos) => new ComponentView(node, view, getPos, this.loader),
                    footnote: (node, view, getPos) => new FootnoteView(node, view, getPos, this.loader),
                }
            });

        this.editorView = editorView;

        // eslint-disable-next-line dot-notation
        window["easyView"] = editorView;

        return editorView;
    }

    public getCurrentState() {
        return this.editorView ? this.editorView.state : this.state;
    }

    private apply(tr: Transaction) {
        if (this.editorView) {
            this.editorView.dispatch(tr);
        } else {
            this.state = this.state.apply(tr);
        }
    }

    private applyTransaction(tr: Transaction) {
        if (tr.getMeta("fluid-local")) {
            return;
        }

        for (const step of tr.steps) {
            // This is a good place for me to tweak changes and ignore local stuff...
            console.log(JSON.stringify(step, null, 2));

            const stepAsJson = step.toJSON();
            switch (stepAsJson.stepType) {
                case "replace": {
                    const from = stepAsJson.from;
                    const to = stepAsJson.to;

                    let operations = new Array<IMergeTreeDeltaOp>();

                    if (from !== to) {
                        const removeOp = createRemoveRangeOp(from, to);
                        operations.push(removeOp);
                    }

                    if (stepAsJson.slice) {
                        const sliceOperations = sliceToGroupOps(
                            from,
                            stepAsJson.slice,
                            this.schema);
                        operations = operations.concat(sliceOperations);
                    }

                    const groupOp = createGroupOp(...operations);
                    this.text.groupOperation(groupOp);

                    break;
                }

                case "replaceAround": {
                    let operations = new Array<IMergeTreeDeltaOp>();

                    const from = stepAsJson.from;
                    const to = stepAsJson.to;
                    const gapFrom = stepAsJson.gapFrom;
                    const gapTo = stepAsJson.gapTo;
                    const insert = stepAsJson.insert;

                    // Export class ReplaceAroundStep extends Step {
                    // :: (number, number, number, number, Slice, number, ?bool)
                    // Create a replace-around step with the given range and gap.
                    // `insert` should be the point in the slice into which the content
                    // of the gap should be moved. `structure` has the same meaning as
                    // it has in the [`ReplaceStep`](#transform.ReplaceStep) class.
                    // {
                    //     "stepType": "replaceAround",
                    //     "from": 0,
                    //     "to": 15,
                    //     "gapFrom": 0,
                    //     "gapTo": 15,
                    //     "insert": 2,
                    //     "slice": {
                    //         "content": [
                    //         {
                    //             "type": "bullet_list",
                    //             "content": [
                    //             {
                    //                 "type": "list_item"
                    //             }
                    //             ]
                    //         }
                    //         ]
                    //     },
                    //     "structure": true
                    //     }

                    if (gapTo !== to) {
                        const removeOp = createRemoveRangeOp(gapTo, to);
                        operations.push(removeOp);
                    }

                    if (gapFrom !== from) {
                        const removeOp = createRemoveRangeOp(from, gapFrom);
                        operations.push(removeOp);
                    }

                    if (stepAsJson.slice) {
                        const sliceOperations = sliceToGroupOps(
                            from,
                            stepAsJson.slice,
                            this.schema,
                            insert ? from + insert : insert,
                            gapTo - gapFrom);
                        operations = operations.concat(sliceOperations);
                    }

                    const groupOp = createGroupOp(...operations);
                    this.text.groupOperation(groupOp);

                    break;
                }

                case "addMark": {
                    const attrs = stepAsJson.mark.attrs || true;

                    this.text.annotateRange(
                        stepAsJson.from,
                        stepAsJson.to,
                        { [stepAsJson.mark.type]: attrs });

                    break;
                }

                case "removeMark": {
                    // Is there a way to actually clear an annotation?
                    this.text.annotateRange(
                        stepAsJson.from,
                        stepAsJson.to,
                        { [stepAsJson.mark.type]: false });

                    break;
                }

                default:
                    break;
            }
        }
    }
}
