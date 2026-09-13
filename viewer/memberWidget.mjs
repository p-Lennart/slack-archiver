function memberWidgetUI(members) {
    const memberNodes = [];

    for (const i of members) {
        let mem = jml('div', { class: 'user'}, [
            jml('img', { class: 'user_picture', src: i.profile['image_72'] }, ),
            jml('div', { class: 'user_text'}, [
                jml('h3', {}, getPrettyName(i)),
                jml('h5', {}, '@' + i.name),
                jml('span', {}, i.profile.title),
            ]),
        ]);

        memberNodes.push(mem);

    }

    return memberNodes;
}
