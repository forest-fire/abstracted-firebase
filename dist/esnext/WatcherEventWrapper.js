function isValueBasedEvent(evt, context) {
    return context.targetType === "query";
}
export const WatcherEventWrapper = (context) => (handler) => {
    return (snapshot, previousChildKey) => {
        const value = snapshot.val();
        const key = snapshot.key;
        const fullEvent = Object.assign({}, context, { value, key, previousChildKey });
        return handler(fullEvent);
    };
};
