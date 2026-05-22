const NotFound = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('rnf', '1');
    window.location.href = url.toString();
    return (<></>)
}

export default NotFound;