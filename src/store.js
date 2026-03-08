import { reactive } from 'vue'

export const store = reactive({
    // Screens
    isStartScreenVisible: true,
    isGameOverVisible: false,
    isInventoryVisible: false,

    // Inventory
    isPickupMode: false,
    pickupItemName: '',
    discardItemIndex: null,
    discardItemName: '',
    examineText: '',

    // HUD
    healthPercent: 100,
    healthStatus: 'normal',
    ammoCurrent: 15,
    ammoMax: 30,
    showColliders: false,
    showDebugMenu: false,
    instaKillCheat: false,
    difficulty: 'normal',
    showLevelEditor: false,
    editorTool: 'select',
    editorLevel: 1,
    editorSelectedId: null,
    editorLevelData: null,

    // Game state
    levelText: 'Level 1',
    feedbackMessage: '',

    // Inventory
    inventory: [null, null, null, null, null, null],
    combineSourceIndex: null,

    // Interaction
    interactTarget: null,

    // Context Menu
    contextMenu: {
        visible: false,
        x: 0,
        y: 0,
        options: []
    }
})
